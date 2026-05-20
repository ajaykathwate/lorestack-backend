import { PlatformRole } from '@prisma/client';

export type JwtUser = {
  sub: string;
  email: string;
  platformRole: PlatformRole;
};
