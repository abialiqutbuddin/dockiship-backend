import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const headerTenant = (req.headers['x-tenant-id'] as string | undefined)?.trim();
    const jwtTenant = req.user?.tenantId as string | undefined;

    const tenantId = headerTenant || jwtTenant;
    if (!tenantId) throw new BadRequestException('Missing X-Tenant-ID header (or tenant in JWT)');
    req.tenantId = tenantId;
    return true;
  }
}