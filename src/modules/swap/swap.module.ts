import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { SwapTransaction } from '../../database/entities/swap-transaction.entity';
import { Quote } from '../../database/entities/quote.entity';
import { CacheModule } from '../cache/cache.module';
import { TokensModule } from '../tokens/tokens.module';
import { QuoteModule } from '../quote/quote.module';
import { JupiterAdapter } from '../adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from '../adapters/okx/okx.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapTransaction, Quote]),
    CacheModule,
    TokensModule,
    QuoteModule,
  ],
  controllers: [SwapController],
  providers: [
    SwapService,
    JupiterAdapter,
    OkxAdapter,
  ],
  exports: [SwapService],
})
export class SwapModule {}
