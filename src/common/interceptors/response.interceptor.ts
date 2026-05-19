import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: boolean; data: T }> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ success: boolean; data: T }> {
    return next.handle().pipe(map((data: T) => ({ success: true, data })));
  }
}
