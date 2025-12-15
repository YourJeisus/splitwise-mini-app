import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AdminRoleType } from './roles.decorator';

const ROLE_HIERARCHY: Record<AdminRoleType, number> = {
  OWNER: 4,
  ADMIN: 3,
  SUPPORT: 2,
  READ_ONLY: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { admin } = context.switchToHttp().getRequest();
    if (!admin?.role) {
      throw new ForbiddenException('Недостаточно прав');
    }

    const adminLevel = ROLE_HIERARCHY[admin.role as AdminRoleType] || 0;
    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r] || 0));
    if (adminLevel < minRequired) {
      throw new ForbiddenException('Недостаточно прав');
    }
    return true;
  }
}




