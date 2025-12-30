import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'adminRoles';
export type AdminRoleType = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'READ_ONLY';

export const Roles = (...roles: AdminRoleType[]) => SetMetadata(ROLES_KEY, roles);









