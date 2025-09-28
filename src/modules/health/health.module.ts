import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { JupiterAdapter } from '../adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from '../adapters/okx/okx.adapter';
import { CacheModule } from '../cache/cache.module';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule.forFeature([]), // Add entities if needed for health checks
    CacheModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    CircuitBreakerService,
    JupiterAdapter,
    OkxAdapter,
  ],
  exports: [HealthService],
})
export class HealthModule {}
