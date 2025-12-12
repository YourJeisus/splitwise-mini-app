import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import {
  CreateReceiptDto,
  ClaimReceiptItemsDto,
} from "./dto/create-receipt.dto";
import sharp from "sharp";
import { ReceiptStatus } from "@prisma/client";

const TRIP_PASS_PRODUCT_CODE = "TRIP_PASS_21D";

export type ScanReceiptResult = {
  amount?: number;
  currency?: string;
  date?: string;
  items?: Array<{ name: string; qty?: number; totalPrice?: number }>;
  warnings?: string[];
};

@Injectable()
export class ExpensesService {
  private readonly ocrRelayUrl: string | undefined;
  private readonly googleVisionApiKey: string | undefined;
  private readonly geminiApiKey: string | undefined;
  private readonly isDev: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    this.ocrRelayUrl = this.config.get<string>("OCR_RELAY_URL");
    this.googleVisionApiKey = this.config.get<string>("GOOGLE_VISION_API_KEY");
    this.geminiApiKey = this.config.get<string>("GEMINI_API_KEY");
    this.isDev = this.config.get<string>("NODE_ENV") === "development";
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Рассчитывает предварительное распределение owed для чека.
   * Выбранные позиции — точно по claims, нераспределённые — поровну между всеми.
   */
  private calculateReceiptOwed(
    items: Array<{
      quantity: number;
      totalPrice: number | { toNumber(): number };
      claims: Array<{ userId: string; quantity: number }>;
    }>,
    memberIds: string[]
  ): Record<string, number> {
    const owedByUser: Record<string, number> = {};
    memberIds.forEach((uid) => (owedByUser[uid] = 0));

    for (const item of items) {
      const totalPrice =
        typeof item.totalPrice === "number"
          ? item.totalPrice
          : Number(item.totalPrice);
      const unitCost = totalPrice / item.quantity;
      const claimedQty = item.claims.reduce((sum, c) => sum + c.quantity, 0);

      // Распределяем по claims
      for (const claim of item.claims) {
        owedByUser[claim.userId] =
          (owedByUser[claim.userId] || 0) + unitCost * claim.quantity;
      }

      // Нераспределённое — поровну на всех
      const unclaimedQty = item.quantity - claimedQty;
      if (unclaimedQty > 0) {
        const unclaimedAmount = unitCost * unclaimedQty;
        const perPerson = unclaimedAmount / memberIds.length;
        memberIds.forEach((uid) => {
          owedByUser[uid] = (owedByUser[uid] || 0) + perPerson;
        });
      }
    }

    // Округляем
    Object.keys(owedByUser).forEach((uid) => {
      owedByUser[uid] = this.round2(owedByUser[uid]);
    });

    return owedByUser;
  }

  private mapExpenseForApi(expense: any) {
    return {
      ...expense,
      amount: expense.settlementAmount,
      currency: expense.settlementCurrency,
    };
  }

  async create(userId: string, dto: CreateExpenseDto) {
    const group = dto.groupId
      ? await this.prisma.group.findUnique({
          where: { id: dto.groupId },
          select: {
            settlementCurrency: true,
            fxMode: true,
            fixedFxRates: true,
            fixedFxDate: true,
            fixedFxSource: true,
            closedAt: true,
          },
        })
      : null;

    if (group?.closedAt) {
      throw new BadRequestException("Группа закрыта");
    }

    const settlementCurrency =
      group?.settlementCurrency ?? dto.currency ?? "USD";

    if (dto.currency && dto.currency !== settlementCurrency) {
      throw new BadRequestException(
        "Валюта траты должна совпадать с валютой расчётов группы"
      );
    }

    const settlementAmount = this.round2(dto.amount);
    const originalCurrency = dto.originalCurrency ?? settlementCurrency;
    const originalAmount = this.round2(dto.originalAmount ?? dto.amount);

    let fxRate: number | null = null;
    let fxDate: Date | null = null;
    let fxSource: string | null = null;

    if (originalCurrency !== settlementCurrency) {
      if (!dto.groupId) {
        throw new BadRequestException("Мультивалюта доступна только в группе");
      }
      const now = new Date();
      const entitlement = await this.prisma.entitlement.findFirst({
        where: {
          groupId: dto.groupId,
          productCode: TRIP_PASS_PRODUCT_CODE,
          endsAt: { gt: now },
        },
        select: { id: true },
      });
      if (!entitlement) {
        throw new BadRequestException(
          "Мультивалютные траты доступны с Trip Pass"
        );
      }
      if (group?.fxMode !== "FIXED") {
        throw new BadRequestException("FX режим не поддерживается");
      }
      const rates = (group.fixedFxRates ?? {}) as Record<string, number>;
      const rate = rates[originalCurrency];
      if (!rate) {
        throw new BadRequestException(
          `Нет фиксированного курса для ${originalCurrency}`
        );
      }
      fxRate = rate;
      fxDate = group.fixedFxDate ?? new Date();
      fxSource = group.fixedFxSource ?? "FIXED";

      const expectedSettlement = this.round2(originalAmount * rate);
      if (Math.abs(expectedSettlement - settlementAmount) > 0.01) {
        throw new BadRequestException("Некорректная сумма после конвертации");
      }
    } else {
      fxRate = 1;
      fxSource = "SETTLEMENT";
    }

    const now = new Date();
    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          description: dto.description,
          settlementAmount,
          settlementCurrency,
          originalAmount,
          originalCurrency,
          fxRate,
          fxDate,
          fxSource,
          category: dto.category,
          groupId: dto.groupId,
          createdById: userId,
          shares: {
            create: dto.shares.map((share) => ({
              userId: share.userId,
              paid: share.paid,
              owed: share.owed,
            })),
          },
        },
        include: { shares: true },
      });

      if (dto.groupId) {
        await tx.group.update({
          where: { id: dto.groupId },
          data: { lastActivityAt: now },
        });
      }

      return created;
    });

    return this.mapExpenseForApi(expense);
  }

  async listByGroup(groupId: string) {
    const [expenses, settlements] = await Promise.all([
      this.prisma.expense.findMany({
        where: { groupId },
        include: {
          shares: {
            include: {
              user: {
                select: { id: true, firstName: true, username: true },
              },
            },
          },
          createdBy: {
            select: { id: true, firstName: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.settlement.findMany({
        where: { groupId },
        include: {
          fromUser: {
            select: { id: true, firstName: true, username: true },
          },
          toUser: {
            select: { id: true, firstName: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Объединяем и сортируем по дате
    const combined = [
      ...expenses.map((e) => ({
        ...this.mapExpenseForApi(e),
        type: "expense" as const,
      })),
      ...settlements.map((s) => ({ ...s, type: "settlement" as const })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return combined;
  }

  async update(
    userId: string,
    expenseId: string,
    dto: {
      description?: string;
      amount?: number;
      shares?: { userId: string; paid: number; owed: number }[];
    }
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) throw new NotFoundException("Расход не найден");

    // Системные траты TRIP_PASS_FEE можно редактировать только shares (покупателем)
    const isTripPassFee =
      expense.isSystem && expense.systemType === "TRIP_PASS_FEE";
    if (expense.isSystem && !isTripPassFee) {
      throw new ForbiddenException("Системный расход нельзя редактировать");
    }
    if (expense.createdById !== userId) {
      throw new ForbiddenException(
        "Только создатель может редактировать расход"
      );
    }

    // Для Trip Pass Fee разрешаем менять только shares
    if (isTripPassFee && (dto.description || dto.amount !== undefined)) {
      throw new ForbiddenException(
        "Для Trip Pass можно изменить только распределение"
      );
    }

    // Если обновляются shares, удаляем старые и создаём новые
    if (dto.shares) {
      await this.prisma.expenseShare.deleteMany({
        where: { expenseId },
      });
    }

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(!isTripPassFee &&
          dto.description && { description: dto.description }),
        ...(!isTripPassFee &&
          dto.amount !== undefined && {
            settlementAmount: this.round2(dto.amount),
            originalAmount: this.round2(dto.amount),
            originalCurrency: expense.settlementCurrency,
            fxRate: 1,
            fxDate: null,
            fxSource: "SETTLEMENT",
          }),
        ...(dto.shares && {
          shares: {
            create: dto.shares.map((share) => ({
              userId: share.userId,
              paid: share.paid,
              owed: share.owed,
            })),
          },
        }),
      },
      include: {
        shares: {
          include: {
            user: {
              select: { id: true, firstName: true, username: true },
            },
          },
        },
      },
    });

    return this.mapExpenseForApi(updated);
  }

  async delete(userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) throw new NotFoundException("Расход не найден");
    if (expense.isSystem) {
      throw new ForbiddenException("Системный расход нельзя удалять");
    }
    if (expense.createdById !== userId) {
      throw new ForbiddenException("Только создатель может удалить расход");
    }

    await this.prisma.$transaction([
      this.prisma.expenseShare.deleteMany({
        where: { expenseId },
      }),
      this.prisma.expense.delete({
        where: { id: expenseId },
      }),
    ]);

    return { success: true };
  }

  async scanReceipt(
    userId: string,
    groupId: string,
    image: Express.Multer.File
  ): Promise<ScanReceiptResult> {
    if (!image) {
      throw new BadRequestException("Изображение не загружено");
    }
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, settlementCurrency: true, closedAt: true },
    });
    if (!group) {
      throw new NotFoundException("Группа не найдена");
    }
    if (group.closedAt) {
      throw new BadRequestException("Группа закрыта");
    }
    const now = new Date();
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        groupId,
        productCode: TRIP_PASS_PRODUCT_CODE,
        endsAt: { gt: now },
      },
      select: { id: true },
    });
    if (!entitlement) {
      throw new ForbiddenException("Сканирование чеков доступно с Trip Pass");
    }

    const ocrText = await this.callOcr(image.buffer);
    console.log("OCR raw text:", ocrText);
    return this.parseReceiptText(ocrText, group.settlementCurrency);
  }

  private async callOcr(imageBuffer: Buffer): Promise<string> {
    // Конвертируем любой формат (включая HEIC) в JPEG
    let jpegBuffer: Buffer;
    try {
      jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
    } catch {
      // Если sharp не справился, используем оригинал
      jpegBuffer = imageBuffer;
    }
    const base64 = jpegBuffer.toString("base64");

    const ocrModel = "gemini-3-pro-preview";
    const ocrPrompt = `Analyze this Russian receipt image. Extract data as JSON.

FINDING THE TOTAL (most important):
1. Look for the line with "ВСЕГО" (not "Всего по секции", not subtotals)
2. Or look for "ИТОГО К ОПЛАТЕ", "СУММА", "К ОПЛАТЕ"
3. The total is the FINAL amount at the bottom before payment info
4. If receipt has sections (Еда, Напитки, Алкоголь), find the GRAND TOTAL after all sections

ITEMS:
- Extract ALL items with their prices
- qty: look for "x2", "×3", "2шт", "2 ш", "2 X". Default is 1
- totalPrice: the total for that line (qty × unit price)
- Include "Сервисный сбор" (service charge) if present

Return JSON:
{
  "total": <number - the ВСЕГО/ИТОГО amount>,
  "currency": "RUB",
  "date": "YYYY-MM-DD" or null,
  "items": [{"name": "...", "qty": 1, "totalPrice": ...}]
}

NO markdown, NO explanation, ONLY JSON.`;

    // JSON Schema для structured output
    const responseSchema = {
      type: "object",
      properties: {
        total: {
          type: "number",
          description: "Total amount to pay from the receipt",
        },
        currency: {
          type: "string",
          description: "Currency code (RUB, USD, EUR, etc.)",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format or null if not found",
        },
        items: {
          type: "array",
          description: "List of items from the receipt",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Name of the item",
              },
              qty: {
                type: "number",
                description: "Quantity (default 1)",
              },
              totalPrice: {
                type: "number",
                description: "Total price for this line item",
              },
            },
            required: ["name", "totalPrice"],
          },
        },
      },
      required: ["total", "items"],
    };

    // OCR relay (Cloudflare Worker) — только для dev (обход гео-блокировок)
    if (this.isDev && this.ocrRelayUrl && this.geminiApiKey) {
      console.log("Using OCR relay:", this.ocrRelayUrl, "model:", ocrModel);
      try {
        const res = await fetch(this.ocrRelayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            apiKey: this.geminiApiKey,
            model: ocrModel,
            prompt: ocrPrompt,
            responseSchema,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error("OCR relay error:", res.status, errText);
          throw new BadRequestException(`OCR relay error: ${res.status}`);
        }
        const data = (await res.json()) as { text?: string };
        console.log("OCR relay response:", data.text?.substring(0, 200));
        return data.text ?? "";
      } catch (err) {
        console.error("OCR relay fetch failed:", err);
        throw new BadRequestException("OCR relay недоступен");
      }
    }

    // Прямой вызов Gemini (prod или если нет relay)
    if (this.geminiApiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${ocrModel}:generateContent?key=${this.geminiApiKey}`;
      const body = {
        contents: [
          {
            parts: [
              { text: ocrPrompt },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
        },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Gemini OCR error:", errText);
        throw new BadRequestException("Gemini OCR error");
      }
      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    if (this.googleVisionApiKey) {
      const url = `https://vision.googleapis.com/v1/images:annotate?key=${this.googleVisionApiKey}`;
      const body = {
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new BadRequestException("Google Vision error");
      }
      const data = (await res.json()) as {
        responses?: Array<{
          fullTextAnnotation?: { text?: string };
          textAnnotations?: Array<{ description?: string }>;
        }>;
      };
      const first = data.responses?.[0];
      return (
        first?.fullTextAnnotation?.text ??
        first?.textAnnotations?.[0]?.description ??
        ""
      );
    }

    throw new BadRequestException("OCR не настроен");
  }

  private parseReceiptText(
    text: string,
    groupCurrency: string
  ): ScanReceiptResult {
    const warnings: string[] = [];
    let amount: number | undefined;
    let currency: string | undefined = groupCurrency;
    let date: string | undefined;
    const items: Array<{ name: string; qty?: number; totalPrice?: number }> =
      [];

    // Пробуем распарсить как JSON (новый формат от Gemini)
    try {
      // Убираем возможные markdown-обёртки
      const jsonText = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const parsed = JSON.parse(jsonText) as {
        total?: number;
        currency?: string;
        date?: string;
        items?: Array<{
          name: string;
          qty?: number;
          quantity?: number;
          totalPrice?: number;
          price?: number;
        }>;
      };

      if (parsed.total !== undefined) {
        amount = this.round2(parsed.total);
      }
      if (parsed.currency) {
        currency = parsed.currency.toUpperCase();
      }
      if (parsed.date) {
        date = parsed.date;
      }
      if (parsed.items && Array.isArray(parsed.items)) {
        for (let item of parsed.items) {
          // Если item это строка JSON, парсим её
          if (typeof item === "string") {
            try {
              item = JSON.parse(item);
            } catch {
              continue;
            }
          }
          if (!item || typeof item !== "object") continue;

          const qty = item.qty ?? item.quantity ?? 1;
          // totalPrice — приоритет, иначе price * qty
          const totalPrice =
            item.totalPrice ?? (item.price ? item.price * qty : undefined);
          if (item.name && totalPrice !== undefined) {
            items.push({
              name: String(item.name),
              qty,
              totalPrice: this.round2(totalPrice),
            });
          }
        }
      }

      if (amount === undefined) {
        warnings.push("Не удалось распознать сумму");
      }

      return { amount, currency, date, items, warnings };
    } catch {
      // Fallback: старый текстовый парсинг
      console.log("JSON parse failed, using text fallback");
    }

    // Fallback: текстовый парсинг
    const totalMatch = text.match(
      /(?:total|итого|сумма|всего|amount|to\s*pay)[:\s]*([0-9][0-9\s.,]*)/i
    );
    if (totalMatch) {
      const raw = totalMatch[1].replace(/\s/g, "").replace(",", ".");
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        amount = this.round2(parsed);
      }
    }

    if (amount === undefined) {
      const nums = text.match(/\d+[.,]\d{2}/g);
      if (nums && nums.length > 0) {
        const candidates = nums
          .map((n) => parseFloat(n.replace(",", ".")))
          .filter((n) => !isNaN(n));
        if (candidates.length > 0) {
          amount = this.round2(Math.max(...candidates));
          warnings.push("Сумма определена приблизительно");
        }
      }
    }

    const currencyMatch = text.match(/\b(USD|EUR|RUB|GBP|TRY|THB|JPY|CNY)\b/i);
    if (currencyMatch) {
      currency = currencyMatch[1].toUpperCase();
    }

    const dateMatch = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (dateMatch) {
      const [, d, m, y] = dateMatch;
      const year = y.length === 2 ? `20${y}` : y;
      date = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // Улучшенный парсинг позиций
    const lines = text.split(/\n/);
    for (const line of lines) {
      // Паттерн: название ... цена (с возможным количеством)
      const itemMatch = line.match(
        /^(.+?)\s+(?:\d+[.,]?\d*\s+)?(\d+[.,]\d{2})\s*$/
      );
      if (itemMatch) {
        const name = itemMatch[1].trim();
        // Пропускаем строки типа "Итого", "Всего", "Скидка"
        if (!/^(итого|всего|total|скидка|наценка|сумма)/i.test(name)) {
          items.push({
            name,
            qty: 1,
            totalPrice: parseFloat(itemMatch[2].replace(",", ".")),
          });
        }
      }
    }

    if (amount === undefined) {
      warnings.push("Не удалось распознать сумму");
    }

    return { amount, currency, date, items, warnings };
  }

  // ========== RECEIPT METHODS ==========

  async createReceipt(userId: string, dto: CreateReceiptDto) {
    console.log("createReceipt called with:", JSON.stringify(dto, null, 2));
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      select: {
        id: true,
        settlementCurrency: true,
        closedAt: true,
        members: { where: { isActive: true }, select: { userId: true } },
      },
    });
    if (!group) throw new NotFoundException("Группа не найдена");
    if (group.closedAt) throw new BadRequestException("Группа закрыта");

    // Проверяем Trip Pass
    const now = new Date();
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        groupId: dto.groupId,
        productCode: TRIP_PASS_PRODUCT_CODE,
        endsAt: { gt: now },
      },
    });
    if (!entitlement) {
      throw new ForbiddenException("Чеки доступны с Trip Pass");
    }

    // Проверяем что paidByUserId — участник группы
    const memberIds = group.members.map((m) => m.userId);
    if (!memberIds.includes(dto.paidByUserId)) {
      throw new BadRequestException("Плательщик не является участником группы");
    }

    const totalAmount = this.round2(dto.totalAmount);
    const itemsSum = dto.items.reduce(
      (sum, it) => sum + this.round2(it.totalPrice),
      0
    );

    // Предварительные owed: изначально всё поровну между участниками
    const initialOwed = this.round2(totalAmount / memberIds.length);

    const result = await this.prisma.$transaction(async (tx) => {
      // Создаём expense с предварительными owed (поровну)
      const expense = await tx.expense.create({
        data: {
          description: dto.description,
          settlementAmount: totalAmount,
          settlementCurrency: group.settlementCurrency,
          originalAmount: totalAmount,
          originalCurrency: dto.currency,
          fxRate: 1,
          fxSource: "SETTLEMENT",
          category: "receipt",
          groupId: dto.groupId,
          createdById: userId,
          shares: {
            create: memberIds.map((uid) => ({
              userId: uid,
              paid: uid === dto.paidByUserId ? totalAmount : 0,
              owed: initialOwed, // Предварительно — поровну
            })),
          },
        },
      });

      // Создаём receipt
      const receipt = await tx.receipt.create({
        data: {
          expenseId: expense.id,
          totalAmount,
          currency: dto.currency,
          date: dto.date ? new Date(dto.date) : null,
          status: ReceiptStatus.PENDING,
          items: {
            create: dto.items.map((item, idx) => ({
              name: item.name,
              quantity: item.quantity,
              totalPrice: this.round2(item.totalPrice),
              unitPrice: item.unitPrice ? this.round2(item.unitPrice) : null,
              sortOrder: idx,
            })),
          },
        },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      });

      // Если создатель сразу выбрал свои позиции
      if (dto.myClaims && dto.myClaims.length > 0) {
        for (const claim of dto.myClaims) {
          const item = receipt.items[claim.itemIndex];
          if (item && claim.quantity > 0) {
            await tx.receiptItemClaim.create({
              data: {
                receiptItemId: item.id,
                userId,
                quantity: Math.min(claim.quantity, item.quantity),
              },
            });
          }
        }

        // Пересчитываем owed после создания claims
        const updatedReceipt = await tx.receipt.findUnique({
          where: { id: receipt.id },
          include: { items: { include: { claims: true } } },
        });
        if (updatedReceipt) {
          const owedByUser = this.calculateReceiptOwed(
            updatedReceipt.items.map((it) => ({
              quantity: it.quantity,
              totalPrice: it.totalPrice,
              claims: it.claims,
            })),
            memberIds
          );
          for (const share of await tx.expenseShare.findMany({
            where: { expenseId: expense.id },
          })) {
            await tx.expenseShare.update({
              where: { id: share.id },
              data: { owed: owedByUser[share.userId] || 0 },
            });
          }
        }
      }

      await tx.group.update({
        where: { id: dto.groupId },
        data: { lastActivityAt: now },
      });

      return { expense, receipt };
    });

    return this.getReceiptDetails(result.receipt.id);
  }

  async getReceiptDetails(receiptId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        expense: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                username: true,
                avatarUrl: true,
              },
            },
            shares: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            group: {
              select: {
                id: true,
                name: true,
                settlementCurrency: true,
                members: {
                  where: { isActive: true },
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        username: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            claims: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    username: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!receipt) throw new NotFoundException("Чек не найден");

    // Вычисляем статистику распределения
    const itemsWithStats = receipt.items.map((item) => {
      const claimedQty = item.claims.reduce((sum, c) => sum + c.quantity, 0);
      const remainingQty = item.quantity - claimedQty;
      return {
        ...item,
        totalPrice: Number(item.totalPrice),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        claimedQuantity: claimedQty,
        remainingQuantity: remainingQty,
        isFullyClaimed: remainingQty <= 0,
      };
    });

    const totalClaimed = itemsWithStats.reduce(
      (sum, it) =>
        sum +
        (it.claimedQuantity > 0
          ? Number(it.totalPrice) * (it.claimedQuantity / it.quantity)
          : 0),
      0
    );
    const totalRemaining = Number(receipt.totalAmount) - totalClaimed;
    const isFullyDistributed = itemsWithStats.every((it) => it.isFullyClaimed);

    // Кто сколько должен (на основе claims)
    const owedByUser: Record<string, number> = {};
    for (const item of itemsWithStats) {
      const unitCost = Number(item.totalPrice) / item.quantity;
      for (const claim of item.claims) {
        owedByUser[claim.userId] =
          (owedByUser[claim.userId] || 0) + unitCost * claim.quantity;
      }
    }

    // Кто заплатил
    const paidByUser: Record<string, number> = {};
    for (const share of receipt.expense.shares) {
      if (Number(share.paid) > 0) {
        paidByUser[share.userId] = Number(share.paid);
      }
    }

    // Кто отметил свои позиции (сделал хотя бы один claim)
    const claimedUserIds = new Set<string>();
    for (const item of receipt.items) {
      for (const claim of item.claims) {
        claimedUserIds.add(claim.userId);
      }
    }

    // Предварительное распределение (если чек не финализирован)
    const isPreliminary = receipt.status !== ReceiptStatus.FINALIZED;

    return {
      id: receipt.id,
      expenseId: receipt.expenseId,
      totalAmount: Number(receipt.totalAmount),
      currency: receipt.currency,
      date: receipt.date,
      status: receipt.status,
      createdAt: receipt.createdAt,
      expense: {
        id: receipt.expense.id,
        description: receipt.expense.description,
        createdBy: receipt.expense.createdBy,
        group: receipt.expense.group,
      },
      items: itemsWithStats,
      stats: {
        totalClaimed: this.round2(totalClaimed),
        totalRemaining: this.round2(totalRemaining),
        isFullyDistributed,
        owedByUser,
        paidByUser,
        claimedUserIds: Array.from(claimedUserIds),
        isPreliminary,
      },
      members: receipt.expense.group?.members.map((m) => m.user) || [],
    };
  }

  async getReceiptByExpenseId(expenseId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { expenseId },
    });
    if (!receipt) return null;
    return this.getReceiptDetails(receipt.id);
  }

  async claimReceiptItems(userId: string, dto: ClaimReceiptItemsDto) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: dto.receiptId },
      include: {
        expense: { select: { groupId: true, createdById: true } },
        items: { include: { claims: true } },
      },
    });

    if (!receipt) throw new NotFoundException("Чек не найден");
    if (receipt.status === ReceiptStatus.FINALIZED) {
      throw new BadRequestException("Чек уже закрыт");
    }

    // Проверяем что пользователь — участник группы
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId: receipt.expense.groupId!,
        userId,
        isActive: true,
      },
    });
    if (!membership) {
      throw new ForbiddenException("Вы не участник этой группы");
    }

    // Определяем для кого делаем claim (по умолчанию — для себя)
    let targetUserId = userId;
    if (dto.forUserId) {
      // Только создатель чека может распределять за других
      if (receipt.expense.createdById !== userId) {
        throw new ForbiddenException(
          "Только создатель чека может распределять за других"
        );
      }
      // Проверяем что целевой пользователь — участник группы
      const targetMembership = await this.prisma.groupMember.findFirst({
        where: {
          groupId: receipt.expense.groupId!,
          userId: dto.forUserId,
          isActive: true,
        },
      });
      if (!targetMembership) {
        throw new BadRequestException(
          "Целевой пользователь не является участником группы"
        );
      }
      targetUserId = dto.forUserId;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const claim of dto.claims) {
        const item = receipt.items.find((it) => it.id === claim.itemId);
        if (!item) continue;

        // Считаем сколько уже забрано другими
        const othersClaimed = item.claims
          .filter((c) => c.userId !== targetUserId)
          .reduce((sum, c) => sum + c.quantity, 0);
        const available = item.quantity - othersClaimed;

        if (claim.quantity <= 0) {
          // Удаляем claim
          await tx.receiptItemClaim.deleteMany({
            where: { receiptItemId: item.id, userId: targetUserId },
          });
        } else {
          const qty = Math.min(claim.quantity, available);
          await tx.receiptItemClaim.upsert({
            where: {
              receiptItemId_userId: {
                receiptItemId: item.id,
                userId: targetUserId,
              },
            },
            create: {
              receiptItemId: item.id,
              userId: targetUserId,
              quantity: qty,
            },
            update: {
              quantity: qty,
            },
          });
        }
      }

      // Получаем обновлённый чек с claims
      const updatedReceipt = await tx.receipt.findUnique({
        where: { id: dto.receiptId },
        include: {
          items: { include: { claims: true } },
          expense: {
            include: {
              shares: true,
              group: {
                select: {
                  members: {
                    where: { isActive: true },
                    select: { userId: true },
                  },
                },
              },
            },
          },
        },
      });

      if (updatedReceipt) {
        // Пересчитываем owed
        const memberIds =
          updatedReceipt.expense.group?.members.map((m) => m.userId) || [];
        const owedByUser = this.calculateReceiptOwed(
          updatedReceipt.items.map((it) => ({
            quantity: it.quantity,
            totalPrice: it.totalPrice,
            claims: it.claims,
          })),
          memberIds
        );

        // Обновляем shares
        for (const share of updatedReceipt.expense.shares) {
          await tx.expenseShare.update({
            where: { id: share.id },
            data: { owed: owedByUser[share.userId] || 0 },
          });
        }

        // Проверяем полностью ли распределён чек
        const isFullyDistributed = updatedReceipt.items.every((item) => {
          const claimed = item.claims.reduce((sum, c) => sum + c.quantity, 0);
          return claimed >= item.quantity;
        });

        if (isFullyDistributed && receipt.status === ReceiptStatus.PENDING) {
          await tx.receipt.update({
            where: { id: dto.receiptId },
            data: { status: ReceiptStatus.DISTRIBUTED },
          });
        } else if (
          !isFullyDistributed &&
          receipt.status === ReceiptStatus.DISTRIBUTED
        ) {
          await tx.receipt.update({
            where: { id: dto.receiptId },
            data: { status: ReceiptStatus.PENDING },
          });
        }
      }
    });

    return this.getReceiptDetails(dto.receiptId);
  }

  async finalizeReceipt(userId: string, receiptId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        expense: {
          include: {
            shares: true,
            group: {
              select: {
                members: {
                  where: { isActive: true },
                  select: { userId: true },
                },
              },
            },
          },
        },
        items: { include: { claims: true } },
      },
    });

    if (!receipt) throw new NotFoundException("Чек не найден");
    if (receipt.status === ReceiptStatus.FINALIZED) {
      throw new BadRequestException("Чек уже финализирован");
    }

    // Только создатель может финализировать
    if (receipt.expense.createdById !== userId) {
      throw new ForbiddenException("Только создатель может закрыть чек");
    }

    // Считаем owed для каждого участника
    const owedByUser: Record<string, number> = {};
    const memberIds = receipt.expense.group?.members.map((m) => m.userId) || [];
    memberIds.forEach((uid) => (owedByUser[uid] = 0));

    for (const item of receipt.items) {
      const unitCost = Number(item.totalPrice) / item.quantity;
      const claimedQty = item.claims.reduce((sum, c) => sum + c.quantity, 0);

      if (claimedQty > 0) {
        // Распределяем по claims
        for (const claim of item.claims) {
          owedByUser[claim.userId] =
            (owedByUser[claim.userId] || 0) + unitCost * claim.quantity;
        }
      }

      // Нераспределённое — поровну на всех
      const unclaimedQty = item.quantity - claimedQty;
      if (unclaimedQty > 0) {
        const unclaimedAmount = unitCost * unclaimedQty;
        const perPerson = unclaimedAmount / memberIds.length;
        memberIds.forEach((uid) => {
          owedByUser[uid] = (owedByUser[uid] || 0) + perPerson;
        });
      }
    }

    // Обновляем shares
    await this.prisma.$transaction(async (tx) => {
      for (const share of receipt.expense.shares) {
        await tx.expenseShare.update({
          where: { id: share.id },
          data: { owed: this.round2(owedByUser[share.userId] || 0) },
        });
      }

      await tx.receipt.update({
        where: { id: receiptId },
        data: { status: ReceiptStatus.FINALIZED },
      });
    });

    return this.getReceiptDetails(receiptId);
  }

  async listGroupReceipts(groupId: string) {
    const receipts = await this.prisma.receipt.findMany({
      where: {
        expense: { groupId },
      },
      include: {
        expense: {
          select: {
            id: true,
            description: true,
            createdById: true,
            createdBy: {
              select: {
                id: true,
                firstName: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
        items: {
          include: {
            claims: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return receipts.map((r) => {
      const totalClaimed = r.items.reduce((sum, item) => {
        const claimedQty = item.claims.reduce((s, c) => s + c.quantity, 0);
        return sum + (Number(item.totalPrice) * claimedQty) / item.quantity;
      }, 0);

      return {
        id: r.id,
        expenseId: r.expenseId,
        totalAmount: Number(r.totalAmount),
        currency: r.currency,
        status: r.status,
        createdAt: r.createdAt,
        expense: r.expense,
        stats: {
          totalClaimed: this.round2(totalClaimed),
          totalRemaining: this.round2(Number(r.totalAmount) - totalClaimed),
          itemsCount: r.items.length,
        },
      };
    });
  }
}
