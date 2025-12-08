import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const initData =
      (request.headers['x-telegram-init-data'] as string | undefined) ??
      request.body?.initData ??
      request.query?.initData;

    if (!initData) {
      throw new UnauthorizedException('Missing Telegram init data');
    }

    const user = await this.authService.verify(initData);
    request.user = user;
    return true;
  }
}

