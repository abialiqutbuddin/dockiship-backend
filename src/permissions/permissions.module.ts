import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';

@Module({
  imports: [PrismaModule],
  providers: [PermissionsService],
  controllers: [PermissionsController],
})
export class PermissionsModule {}