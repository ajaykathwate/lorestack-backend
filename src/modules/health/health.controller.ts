import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '@common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Public()        // No JWT required — Fly health checks are unauthenticated
  @SkipThrottle()  // Exclude from rate limiting — Fly polls every 30s
  @ApiOkResponse({ description: 'Returns service and database health.' })
  check() {
    return this.healthService.check();
  }
}
