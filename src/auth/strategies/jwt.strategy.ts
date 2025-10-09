import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret',
    });
  }

  async validate(payload: any) {
    // put whatever you need from payload on req.user
    return {
      sub: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles ?? [],
      perms: payload.perms ?? [],
      typ: payload.typ, // 'owner' | 'member'
    };
  }
}