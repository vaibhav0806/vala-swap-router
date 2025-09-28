import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { Quote } from '../../database/entities/quote.entity';
import { CacheModule } from '../cache/cache.module';
import { TokensModule } from '../tokens/tokens.module';
import { JupiterAdapter } from '../adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from '../adapters/okx/okx.adapter';
import { RouteEngineService } from '../route-engine/route-engine.service';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote]),
    CacheModule,
    TokensModule,
  ],
  controllers: [QuoteController],
  providers: [
    QuoteService,
    CircuitBreakerService,
    JupiterAdapter,
    OkxAdapter,
    RouteEngineService,
  ],
  exports: [QuoteService],
})
export class QuoteModule {}
