import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MemberLoginDto, OwnerLoginDto } from './dto/login.dto';
import { RegisterOwnerDto } from './dto/register-owner.dto';
import { ChangePasswordDto, RequestPasswordResetDto, ResetPasswordDto } from './dto/password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  // Owner register (global user only, no tenant)
  @Post('owner/register')
  ownerRegister(@Body() dto: RegisterOwnerDto) {
    return this.auth.ownerRegister(dto.email, dto.password, dto.fullName);
  }

  // Owner login — may return list of owned tenants if tenantId not provided
  @Post('owner/login')
  ownerLogin(@Body() dto: OwnerLoginDto) {
    return this.auth.ownerLogin(dto.email, dto.password, dto.tenantId);
  }

  // Member login — if tenantId omitted, returns needTenantSelection + list; if provided, returns tenant-scoped token
  @Post('member/login')
  memberLogin(@Body() dto: MemberLoginDto) {
    return this.auth.memberLogin(dto.email, dto.password, dto.tenantId);
  }
  // ---- Password reset (shared for owner/member) ----

  // 1) user enters email -> we email a short-lived tokenized link
  @Post('password/request')
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email, dto.tenantId);
  }

  // 2) frontend calls with token + new password
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  // Optional: logged-in users can change password without email links
  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changeOwnPassword(dto.currentPassword, dto.newPassword);
  }

  // ✅ Tenant-scoped token validation + profile
  @UseGuards(JwtAuthGuard)
  @Get('check')
  async check(@Req() req: any) {
    // req.user is populated by JwtStrategy.validate(payload)
    return this.auth.check(req.user);
  }

}