import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  ttl: parseInt(process.env.CACHE_TTL || '30000', 10), // 30 seconds default
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  connectTimeout: 2000,
  lazyConnect: true,
  keepAlive: 30000,
}));
