import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMS_KEY } from '../decorators/permissions.decorator';

const SUPER_ROLES = ['Owner', 'Admin'];

function hasPermission(requiredPerms: string[], userPerms: string[]): boolean {
  if (!requiredPerms?.length) return true;
  if (!userPerms?.length) return false;

  const userSet = new Set(userPerms);
  if (userSet.has('*')) return true;

  // Expand user perms to module wildcards: "inventory.read" -> also allow "inventory.*"
  const expanded = new Set<string>();
  for (const p of userPerms) {
    expanded.add(p);
    const modulePart = p.split('.')[0];
    if (modulePart) expanded.add(`${modulePart}.*`);
  }

  // Match exact or by module wildcard on the REQUIRED side
  return requiredPerms.some((req) => {
    if (expanded.has(req)) return true;
    const reqModule = req.split('.')[0];
    return !!reqModule && expanded.has(`${reqModule}.*`);
  });
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    const userRoles: string[] = user.roles ?? [];
    const userPerms: string[] = user.perms ?? [];

    // 1) Role check (if specified)
    if (requiredRoles?.length) {
      const ok = requiredRoles.some((role) => userRoles.includes(role));
      if (!ok) throw new ForbiddenException('Insufficient role');
    }

    // 2) SUPER ROLE bypass for permissions
    const isSuper = userRoles.some((r) => SUPER_ROLES.includes(r));

    // 3) Permission check (skip if super)
    if (!isSuper && requiredPerms?.length) {
      const ok = hasPermission(requiredPerms, userPerms);
      if (!ok) throw new ForbiddenException('Missing permission');
    }

    // 4) (Optional) enforce tenant header matches JWT tenant
    if (req.tenantId && user.tenantId && req.tenantId !== user.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}