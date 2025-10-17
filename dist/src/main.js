"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // CORS so other devices/browsers can call your API
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
    const HOST = '0.0.0.0';
    await app.listen(PORT, HOST);
    console.log(`API on http://${HOST}:${PORT} (LAN reachable)`);
}
bootstrap();
//# sourceMappingURL=main.js.map