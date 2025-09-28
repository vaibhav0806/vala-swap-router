import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheService } from './cache.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        
        return {
          store: redisStore,
          host: redisConfig.host,
          port: redisConfig.port,
          ttl: redisConfig.ttl,
          maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
          retryDelayOnFailover: redisConfig.retryDelayOnFailover,
          connectTimeout: redisConfig.connectTimeout,
          lazyConnect: redisConfig.lazyConnect,
          keepAlive: redisConfig.keepAlive,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
