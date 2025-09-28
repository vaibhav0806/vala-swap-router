import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { HealthService, HealthStatus } from './health.service';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';
import { ErrorCode } from 'src/common/enums/error-codes.enum';
import { SwapException } from 'src/common/exceptions/swap.exception';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly circuitBreakerService: CircuitBreakerService, // Add this
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Simple health check',
    description: 'Returns basic health status for load balancers and monitoring systems'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is unhealthy' 
  })
  async healthCheck() {
    const health = await this.healthService.getSimpleHealth();
    return health;
  }

  @Get('detailed')
  @ApiOperation({ 
    summary: 'Detailed health check',
    description: 'Returns comprehensive health status including all services and performance metrics'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Detailed health information',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
        version: { type: 'string' },
        services: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'healthy' },
                responseTime: { type: 'number' },
                lastCheck: { type: 'string' }
              }
            },
            cache: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'healthy' },
                responseTime: { type: 'number' },
                lastCheck: { type: 'string' }
              }
            },
            jupiter: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'healthy' },
                responseTime: { type: 'number' },
                lastCheck: { type: 'string' }
              }
            },
            okx: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'healthy' },
                responseTime: { type: 'number' },
                lastCheck: { type: 'string' }
              }
            }
          }
        },
        performance: {
          type: 'object',
          properties: {
            memoryUsage: { type: 'object' },
            cpuUsage: { type: 'object' }
          }
        }
      }
    }
  })
  async detailedHealthCheck(): Promise<HealthStatus> {
    return this.healthService.getHealthStatus();
  }

  @Get('live')
  @ApiOperation({ 
    summary: 'Liveness probe',
    description: 'Kubernetes liveness probe endpoint - checks if the application is running'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Application is alive' 
  })
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ 
    summary: 'Readiness probe',
    description: 'Kubernetes readiness probe endpoint - checks if the application is ready to serve traffic'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Application is ready' 
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Application is not ready' 
  })
  async ready() {
    const health = await this.healthService.getSimpleHealth();
    if (health.status === 'ok') {
      return { status: 'ready', timestamp: health.timestamp };
    } else {
      throw new Error('Application not ready');
    }
  }

  @Get('circuit-breakers')
  @ApiOperation({ 
    summary: 'Get circuit breaker status',
    description: 'Returns the current state of all circuit breakers'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Circuit breaker status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        circuitBreakers: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              state: { type: 'string', enum: ['closed', 'open', 'half_open'] },
              failureCount: { type: 'number' },
              successCount: { type: 'number' },
              lastFailureTime: { type: 'number', nullable: true },
              lastSuccessTime: { type: 'number', nullable: true },
              nextAttemptTime: { type: 'number', nullable: true }
            }
          }
        }
      }
    }
  })
  async getCircuitBreakerStatus() {
    return {
      circuitBreakers: this.circuitBreakerService.getAllCircuitStates(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('circuit-breakers/:serviceName/reset')
  @ApiOperation({ 
    summary: 'Reset circuit breaker',
    description: 'Manually reset a circuit breaker to closed state'
  })
  @ApiParam({ 
    name: 'serviceName', 
    description: 'Name of the service circuit breaker to reset',
    example: 'jupiter'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Circuit breaker reset successfully'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Circuit breaker not found'
  })
  async resetCircuitBreaker(@Param('serviceName') serviceName: string) {
    const currentState = this.circuitBreakerService.getCircuitState(serviceName);
    
    if (!currentState) {
      throw new SwapException(ErrorCode.ROUTE_NOT_FOUND, {
        serviceName,
        message: 'Circuit breaker not found',
      });
    }

    this.circuitBreakerService.resetCircuit(serviceName);

    return {
      serviceName,
      message: 'Circuit breaker reset successfully',
      previousState: currentState.state,
      timestamp: new Date().toISOString(),
    };
  }
}
