import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule,AuthModule],
  providers: [RbacService],
  controllers: [RbacController],
  exports: [RbacService],
})
export class RbacModule {}