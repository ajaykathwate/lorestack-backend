import { PlatformRole } from '@prisma/client';

export interface TokenPayload {
  sub: string;
  email: string;
  platformRole: PlatformRole;
}
