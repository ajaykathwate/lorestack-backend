import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

import { CORRELATION_ID_HEADER } from '@common/middleware/correlation-id.middleware';

type WrappedResponse<T> = {
  success: boolean;
  data: T;
  requestId?: string;
};

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, WrappedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<WrappedResponse<T>> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const requestId = request.headers[CORRELATION_ID_HEADER];

    return next.handle().pipe(map((data: T) => ({ success: true, data, requestId })));
  }
}
