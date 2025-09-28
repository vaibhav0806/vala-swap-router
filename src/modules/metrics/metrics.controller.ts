import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';
import { register } from 'prom-client';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  @ApiOperation({ 
    summary: 'Get metrics summary',
    description: 'Internal endpoint for debugging metrics (not exposed to Prometheus)'
  })
  @ApiExcludeEndpoint() // Exclude from public Swagger docs
  async getMetricsSummary() {
    return this.metricsService.getMetricsSummary();
  }

  @Get('cache-stats')
  @ApiOperation({ 
    summary: 'Get cache statistics',
    description: 'Get cache hit ratios by type'
  })
  @ApiExcludeEndpoint()
  async getCacheStats() {
    return {
      route: this.metricsService.calculateCacheHitRatio('route'),
      quote: this.metricsService.calculateCacheHitRatio('quote'),
      token: this.metricsService.calculateCacheHitRatio('token'),
    };
  }

  @Get('prometheus')
  @ApiOperation({ 
    summary: 'Prometheus metrics endpoint',
    description: 'Prometheus metrics in exposition format'
  })
  @ApiExcludeEndpoint()
  async getPrometheusMetrics(@Res() response: Response) {
    response.set('Content-Type', register.contentType);
    response.send(await register.metrics());
  }
}
