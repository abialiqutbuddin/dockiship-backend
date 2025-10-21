import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { EmailModule } from '../email/email.module';
import { JwtModule } from '@nestjs/jwt';
import { InvitationsController } from './invitations.controller';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [UserService],
  controllers: [UserController,InvitationsController],
  exports: [UserService],
})
export class UsersModule {}