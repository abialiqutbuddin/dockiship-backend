"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantId = void 0;
const common_1 = require("@nestjs/common");
exports.TenantId = (0, common_1.createParamDecorator)((_, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    return req.tenantId ?? req.user?.tenantId;
});
//# sourceMappingURL=tenant.decorator.js.map