import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { RequestContextData } from '../interfaces/request-context.interface';

export const RequestContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContextData => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  },
);
