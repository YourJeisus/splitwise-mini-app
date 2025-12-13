import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sharp from "sharp";

export type ScanReceiptResult = {
  amount?: number;
  currency?: string;
  date?: string;
  items?: Array<{ name: string; qty?: number; totalPrice?: number }>;
  warnings?: string[];
};

@Injectable()
export class OcrService {
  private readonly ocrRelayUrl: string | undefined;
  private readonly googleVisionApiKey: string | undefined;
  private readonly geminiApiKey: string | undefined;
  private readonly isDev: boolean;

  constructor(private readonly config: ConfigService) {
    this.ocrRelayUrl = this.config.get<string>("OCR_RELAY_URL");
    this.googleVisionApiKey = this.config.get<string>("GOOGLE_VISION_API_KEY");
    this.geminiApiKey = this.config.get<string>("GEMINI_API_KEY");
    this.isDev = this.config.get<string>("NODE_ENV") === "development";
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async callOcr(imageBuffer: Buffer): Promise<string> {
    let jpegBuffer: Buffer;
    try {
      jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 85 }).toBuffer();
    } catch {
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
              name: { type: "string", description: "Name of the item" },
              qty: { type: "number", description: "Quantity (default 1)" },
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

    if (this.geminiApiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${ocrModel}:generateContent?key=${this.geminiApiKey}`;
      const body = {
        contents: [
          {
            parts: [
              { text: ocrPrompt },
              { inline_data: { mime_type: "image/jpeg", data: base64 } },
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

  parseReceiptText(text: string, groupCurrency: string): ScanReceiptResult {
    const warnings: string[] = [];
    let amount: number | undefined;
    let currency: string | undefined = groupCurrency;
    let date: string | undefined;
    const items: Array<{ name: string; qty?: number; totalPrice?: number }> =
      [];

    try {
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
          if (typeof item === "string") {
            try {
              item = JSON.parse(item);
            } catch {
              continue;
            }
          }
          if (!item || typeof item !== "object") continue;

          const qty = item.qty ?? item.quantity ?? 1;
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
      console.log("JSON parse failed, using text fallback");
    }

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

    const lines = text.split(/\n/);
    for (const line of lines) {
      const itemMatch = line.match(
        /^(.+?)\s+(?:\d+[.,]?\d*\s+)?(\d+[.,]\d{2})\s*$/
      );
      if (itemMatch) {
        const name = itemMatch[1].trim();
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
}

