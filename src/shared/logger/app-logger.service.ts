import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class AppLoggerService {
  constructor(@InjectPinoLogger(AppLoggerService.name) private readonly logger: PinoLogger) {}

  log(message: string, context?: Record<string, unknown>) {
    this.logger.info(context ?? {}, message);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.logger.error(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.logger.warn(context ?? {}, message);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.logger.debug(context ?? {}, message);
  }
}
