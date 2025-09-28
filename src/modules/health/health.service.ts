import { Injectable, Logger } from '@nestjs/common';
import { TypeOrmHealthIndicator, HealthCheckService } from '@nestjs/terminus';
import { JupiterAdapter } from '../adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from '../adapters/okx/okx.adapter';
import { CacheService } from '../cache/cache.service';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    jupiter: ServiceHealth;
    okx: ServiceHealth;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  details?: any;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private jupiterAdapter: JupiterAdapter,
    private okxAdapter: OkxAdapter,
    private cacheService: CacheService,
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    try {
      // Check all services in parallel
      const [database, cache, jupiter, okx] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkCache(),
        this.checkJupiter(),
        this.checkOkx(),
      ]);

      const services = {
        database: this.getServiceResult(database),
        cache: this.getServiceResult(cache),
        jupiter: this.getServiceResult(jupiter),
        okx: this.getServiceResult(okx),
      };

      // Determine overall status
      const allHealthy = Object.values(services).every(service => service.status === 'healthy');
      const anyDegraded = Object.values(services).some(service => service.status === 'degraded');
      
      const status = allHealthy ? 'ok' : 'error';

      return {
        status,
        timestamp,
        uptime,
        version: process.env.npm_package_version || '1.0.0',
        services,
        performance: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      
      return {
        status: 'error',
        timestamp,
        uptime,
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: { status: 'unhealthy', lastCheck: timestamp },
          cache: { status: 'unhealthy', lastCheck: timestamp },
          jupiter: { status: 'unhealthy', lastCheck: timestamp },
          okx: { status: 'unhealthy', lastCheck: timestamp },
        },
        performance: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
      };
    }
  }

  async getSimpleHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      const fullHealth = await this.getHealthStatus();
      return {
        status: fullHealth.status,
        timestamp: fullHealth.timestamp,
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      await this.health.check([
        () => this.db.pingCheck('database'),
      ]);
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: error.message,
      };
    }
  }

  private async checkCache(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      await this.cacheService.set(testKey, testValue, 5000);
      const retrieved = await this.cacheService.get(testKey);
      await this.cacheService.del(testKey);
      
      const isHealthy = retrieved === testValue;
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: error.message,
      };
    }
  }

  private async checkJupiter(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.jupiterAdapter.isHealthy();
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: error.message,
      };
    }
  }

  private async checkOkx(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.okxAdapter.isHealthy();
      
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        details: error.message,
      };
    }
  }

  private getServiceResult(result: PromiseSettledResult<ServiceHealth>): ServiceHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: result.reason?.message || 'Unknown error',
      };
    }
  }
}
