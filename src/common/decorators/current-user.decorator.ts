import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { JwtUser } from '@modules/auth/types/jwt-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    return request.user;
  },
);
