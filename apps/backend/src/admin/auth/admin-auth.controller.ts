import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './admin.decorator';
import { LoginDto } from './dto/login.dto';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(AdminJwtGuard)
  @Get('me')
  getMe(@CurrentAdmin() admin: { id: string }) {
    return this.authService.getMe(admin.id);
  }

  @UseGuards(AdminJwtGuard, RolesGuard)
  @Roles('OWNER')
  @Post('create-admin')
  createAdmin(@Body() body: { email: string; passwordHash: string; role: any }) {
    // В сервисе метод ожидает password (он его хеширует), 
    // но в dto из соображений безопасности назовем просто password
    return this.authService.createAdmin(body.email, (body as any).password, body.role);
  }
}









