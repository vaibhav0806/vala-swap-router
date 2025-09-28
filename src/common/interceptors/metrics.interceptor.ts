import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../../modules/metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    const startTime = Date.now();
    const method = request.method;
    const route = this.extractRoute(request);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        
        this.metricsService.trackRequest(method, route, statusCode, duration);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        
        this.metricsService.trackRequest(method, route, statusCode, duration);
        
        // Track specific error if it's a SwapException
        if (error.errorCode) {
          this.metricsService.trackError(error.errorCode, undefined, route);
        }
        
        throw error;
      }),
    );
  }

  private extractRoute(request: Request): string {
    // Extract route pattern for better grouping
    const path = request.route?.path || request.path;
    
    // Replace UUID patterns with placeholders for better metric grouping
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/[1-9A-HJ-NP-Za-km-z]{32,44}/g, '/:address');
  }
}
