import { NestFactory } from '@nestjs/core';
import { webcrypto } from 'crypto';

// Polyfill for crypto in older Node.js versions
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as any;
}
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { SwapExceptionFilter } from './common/filters/swap-exception.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { MetricsService } from './modules/metrics/metrics.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(morgan('combined'));

  // CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'development' ? true : false,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: process.env.NODE_ENV === 'production',
  }));

  // Global exception filter
  app.useGlobalFilters(new SwapExceptionFilter());

  // Global interceptors for observability
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  
  // Get MetricsService and create MetricsInterceptor instance
  const metricsService = app.get(MetricsService);
  app.useGlobalInterceptors(new MetricsInterceptor(metricsService));

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix - BUT exclude /metrics from the prefix
  app.setGlobalPrefix('api', {
    exclude: ['metrics', 'healthz'], // Exclude metrics and healthz from api prefix
  });

  // Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('VALA Swap Router API')
      .setDescription('A high-performance DEX aggregator for Solana swaps')
      .setVersion('1.0')
      .addTag('health', 'Health check endpoints')
      .addTag('tokens', 'Token information endpoints')
      .addTag('quote', 'Quote endpoints')
      .addTag('swap', 'Swap execution endpoints')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = configService.get('app.port');
  await app.listen(port);

  console.log(`🚀 VALA Swap Router is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`🔍 Health Check: http://localhost:${port}/api/v1/healthz`);
  console.log(`📊 Metrics: http://localhost:${port}/api/v1/metrics/prometheus`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
