// src/users/invitations.controller.ts
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly users: UserService) {}

  @Post('accept') // public
  accept(@Body() body: { token: string }) {
    if (!body?.token) throw new BadRequestException('token is required');
    return this.users.acceptInvitation(body.token);
  }
}