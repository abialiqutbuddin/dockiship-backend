import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    tenantId?: string;
    user?: {
      sub: string;
      email: string;
      tenantId?: string;
      roles?: string[];
      perms?: string[];
      typ?: 'owner' | 'member';
      // add other claims if needed
    };
  }
}