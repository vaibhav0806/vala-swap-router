import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

// Configuration imports
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import appConfig from './config/app.config';
import dexConfig from './config/dex.config';

// Module imports
import { CacheModule } from './modules/cache/cache.module';
import { HealthModule } from './modules/health/health.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { QuoteModule } from './modules/quote/quote.module';
import { SwapModule } from './modules/swap/swap.module';

// Entity imports
import { Token } from './database/entities/token.entity';
import { SwapTransaction } from './database/entities/swap-transaction.entity';
import { Quote } from './database/entities/quote.entity';

// Adapter imports
import { JupiterAdapter } from './modules/adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from './modules/adapters/okx/okx.adapter';
import { RouteEngineService } from './modules/route-engine/route-engine.service';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, appConfig, dexConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        entities: [Token, SwapTransaction, Quote],
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{
          ttl: configService.get('app.rateLimitTtl') || 60000,
          limit: configService.get('app.rateLimitMax') || 100,
        }],
      }),
      inject: [ConfigService],
    }),

    // Scheduling for background tasks
    ScheduleModule.forRoot(),

    // Health checks
    TerminusModule,

    // Metrics
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'vala_swap_',
        },
      },
    }),

    // Application modules
    CacheModule,
    HealthModule,
    TokensModule,
    QuoteModule,
    SwapModule,
  ],
  providers: [
    JupiterAdapter,
    OkxAdapter,
    RouteEngineService,
  ],
})
export class AppModule {}