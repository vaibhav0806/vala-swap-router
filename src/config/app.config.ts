import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  
  // Performance settings
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '5000', 10),
  
  // Rate limiting
  rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  
  // Circuit breaker settings
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
  circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000', 10),
  
  // Monitoring
  metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-this',
  apiKey: process.env.API_KEY,
}));
