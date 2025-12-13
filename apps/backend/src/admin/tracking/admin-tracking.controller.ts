import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from "@nestjs/common";
import { AdminJwtGuard } from "../auth/admin-jwt.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { AdminAuditService } from "../audit/admin-audit.service";
import { AdminTrackingService } from "./admin-tracking.service";
import { CreateTrackingLinkDto } from "./dto/create-tracking-link.dto";
import { UpdateTrackingLinkDto } from "./dto/update-tracking-link.dto";

@Controller("admin/tracking")
@UseGuards(AdminJwtGuard, RolesGuard)
export class AdminTrackingController {
  constructor(
    private trackingService: AdminTrackingService,
    private auditService: AdminAuditService
  ) {}

  @Get()
  @Roles("READ_ONLY", "SUPPORT", "ADMIN", "OWNER")
  list(
    @Query("page") page?: string,
    @Query("search") search?: string,
    @Query("enabled") enabled?: string
  ) {
    return this.trackingService.list({
      page: page ? parseInt(page, 10) : 1,
      search,
      enabled: enabled !== undefined ? enabled === "true" : undefined,
    });
  }

  @Get(":id")
  @Roles("READ_ONLY", "SUPPORT", "ADMIN", "OWNER")
  getById(@Param("id") id: string) {
    return this.trackingService.getById(id);
  }

  @Get(":id/stats")
  @Roles("READ_ONLY", "SUPPORT", "ADMIN", "OWNER")
  getStats(
    @Param("id") id: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.trackingService.getStats(id, { from, to });
  }

  @Post()
  @Roles("ADMIN", "OWNER")
  async create(@Body() dto: CreateTrackingLinkDto, @Req() req: any) {
    const link = await this.trackingService.create(dto);
    await this.auditService.log({
      adminId: req.user.id,
      adminRole: req.user.role,
      action: "CREATE_TRACKING_LINK",
      targetType: "TrackingLink",
      targetId: link.id,
      after: link,
      reason: dto.reason,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return link;
  }

  @Patch(":id")
  @Roles("ADMIN", "OWNER")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateTrackingLinkDto,
    @Req() req: any
  ) {
    const before = await this.trackingService.getById(id);
    const link = await this.trackingService.update(id, dto);
    await this.auditService.log({
      adminId: req.user.id,
      adminRole: req.user.role,
      action: "UPDATE_TRACKING_LINK",
      targetType: "TrackingLink",
      targetId: id,
      before,
      after: link,
      reason: dto.reason,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return link;
  }

  @Delete(":id")
  @Roles("ADMIN", "OWNER")
  async delete(
    @Param("id") id: string,
    @Body("reason") reason: string,
    @Req() req: any
  ) {
    const before = await this.trackingService.getById(id);
    const result = await this.trackingService.delete(id);
    await this.auditService.log({
      adminId: req.user.id,
      adminRole: req.user.role,
      action: "DELETE_TRACKING_LINK",
      targetType: "TrackingLink",
      targetId: id,
      before,
      reason: reason || "Удаление трекинг-ссылки",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return result;
  }
}
