import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentAdmin } from "../auth/admin.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { SupportService } from "../../support/support.service";
import { SupportStatus, AdminRole } from "@prisma/client";

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller("admin/support")
export class AdminSupportController {
  constructor(
    private prisma: PrismaService,
    private supportService: SupportService
  ) {}

  @Get("tickets")
  @Roles("SUPPORT")
  async listTickets(
    @Query("status") status?: SupportStatus,
    @Query("assigned") assigned?: string,
    @Query("search") search?: string,
    @Query("page") page: string = "1"
  ) {
    const p = parseInt(page, 10);
    const limit = 50;
    const skip = (p - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (assigned === "me") {
      // Это обработаем на фронте или передадим adminId
    } else if (assigned) {
      where.assignedAdminId = assigned;
    }

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { telegramId: { contains: search, mode: "insensitive" } } },
        { messages: { some: { text: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, telegramId: true, username: true, avatarUrl: true } },
          assignedAdmin: { select: { id: true, email: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { items, total, page: p, limit };
  }

  @Get("tickets/:id")
  @Roles("SUPPORT")
  async getTicket(@Param("id") id: string) {
    return this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: true,
        assignedAdmin: { select: { id: true, email: true } },
      },
    });
  }

  @Get("tickets/:id/messages")
  @Roles("SUPPORT")
  async getMessages(@Param("id") id: string) {
    return this.prisma.supportMessage.findMany({
      where: { ticketId: id },
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  @Post("tickets/:id/messages")
  @Roles("SUPPORT")
  async reply(
    @Param("id") id: string,
    @Body() body: { text: string },
    @CurrentAdmin() admin: { id: string }
  ) {
    return this.supportService.addAdminMessage(id, admin.id, body.text);
  }

  @Patch("tickets/:id/assign")
  @Roles("SUPPORT")
  async assign(
    @Param("id") id: string,
    @Body() body: { adminId: string | null }
  ) {
    return this.supportService.assignTicket(id, body.adminId);
  }

  @Patch("tickets/:id/status")
  @Roles("SUPPORT")
  async setStatus(
    @Param("id") id: string,
    @Body() body: { status: SupportStatus }
  ) {
    return this.supportService.setTicketStatus(id, body.status);
  }

  @Get("notifications")
  @Roles("SUPPORT")
  async getNotifications(
    @CurrentAdmin() admin: { id: string },
    @Query("unread") unread?: string
  ) {
    const where: any = { adminId: admin.id };
    if (unread === "true") where.read = false;

    return this.prisma.adminNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @Post("notifications/mark-read")
  @Roles("SUPPORT")
  async markNotificationsRead(
    @CurrentAdmin() admin: { id: string },
    @Body() body: { ids?: string[]; ticketId?: string }
  ) {
    const where: any = { adminId: admin.id };
    if (body.ids) {
      where.id = { in: body.ids };
    } else if (body.ticketId) {
      where.data = { path: ["ticketId"], equals: body.ticketId };
    }

    return this.prisma.adminNotification.updateMany({
      where,
      data: { read: true },
    });
  }

  @Get("admins")
  @Roles("ADMIN")
  async listSupportAdmins() {
    return this.prisma.adminUser.findMany({
      where: {
        enabled: true,
        role: { in: [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPPORT] },
      },
      select: {
        id: true,
        email: true,
        role: true,
        telegramUserId: true,
        telegramChatId: true,
        supportNotificationsEnabled: true,
      },
      orderBy: { email: "asc" },
    });
  }

  @Post("admins/:id/link-token")
  @Roles("ADMIN")
  async generateToken(@Param("id") id: string) {
    return this.supportService.generateLinkToken(id);
  }

  @Patch("admins/:id/notifications")
  @Roles("ADMIN")
  async toggleNotifications(
    @Param("id") id: string,
    @Body() body: { enabled: boolean }
  ) {
    return this.prisma.adminUser.update({
      where: { id },
      data: { supportNotificationsEnabled: body.enabled },
    });
  }
}

