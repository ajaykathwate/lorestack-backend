import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('metrics')
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  @Get()
  @ApiOkResponse({ description: 'Returns basic process metrics.' })
  getMetrics() {
    const memory = process.memoryUsage();

    return {
      uptimeSeconds: process.uptime(),
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
