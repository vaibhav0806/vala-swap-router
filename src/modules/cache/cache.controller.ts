import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CacheService } from './cache.service';
import { MetricsService } from '../metrics/metrics.service';

@ApiTags('cache')
@Controller('cache')
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('coalescing/stats')
  @ApiOperation({ 
    summary: 'Get request coalescing statistics',
    description: 'Returns current coalescing performance metrics'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Coalescing statistics',
    schema: {
      type: 'object',
      properties: {
        current: {
          type: 'object',
          properties: {
            pendingRequests: { type: 'number' },
            activeMetrics: { type: 'number' },
            pendingKeys: { type: 'array', items: { type: 'string' } }
          }
        },
        effectiveness: {
          type: 'object',
          properties: {
            totalOriginalRequests: { type: 'number' },
            totalDuplicateRequests: { type: 'number' },
            totalRequestsSaved: { type: 'number' },
            coalescingRatio: { type: 'number' }
          }
        }
      }
    }
  })
  async getCoalescingStats() {
    return {
      current: this.cacheService.getCoalescingStats(),
      effectiveness: this.metricsService.getCoalescingEffectiveness(),
      timestamp: new Date().toISOString(),
    };
  }
}
