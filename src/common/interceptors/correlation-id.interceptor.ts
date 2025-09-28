import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_KEY = Symbol('correlationId');

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Get correlation ID from header or generate a new one
    let correlationId = request.headers[CORRELATION_ID_HEADER] as string;
    
    if (!correlationId) {
      correlationId = this.generateCorrelationId();
    }
    
    // Store correlation ID in request object for access in services
    request[CORRELATION_ID_KEY] = correlationId;
    
    // Add correlation ID to response headers
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    
    return next.handle();
  }

  private generateCorrelationId(): string {
    // Generate a short, readable correlation ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `${timestamp}-${random}`;
  }
}

// Utility function to get correlation ID from request context
export function getCorrelationId(request?: any): string {
  return request?.[CORRELATION_ID_KEY] || 'unknown';
}
