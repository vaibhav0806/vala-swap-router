import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { getCorrelationId } from '../interceptors/correlation-id.interceptor';

interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

@Injectable()
export class EnhancedLogger implements LoggerService {
  private context: string;

  constructor(context?: string) {
    this.context = context || 'Application';
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: LogContext) {
    this.print('log', message, context);
  }

  error(message: any, trace?: string, context?: LogContext) {
    this.print('error', message, { ...context, trace });
  }

  warn(message: any, context?: LogContext) {
    this.print('warn', message, context);
  }

  debug(message: any, context?: LogContext) {
    this.print('debug', message, context);
  }

  verbose(message: any, context?: LogContext) {
    this.print('verbose', message, context);
  }

  // Enhanced methods with structured logging
  logWithCorrelation(level: LogLevel, message: string, context: LogContext = {}, request?: any) {
    const correlationId = context.correlationId || getCorrelationId(request);
    this.print(level, message, { ...context, correlationId });
  }

  logOperation(operation: string, duration: number, context: LogContext = {}, request?: any) {
    const correlationId = context.correlationId || getCorrelationId(request);
    this.print('log', `Operation completed: ${operation}`, {
      ...context,
      correlationId,
      operation,
      duration,
    });
  }

  logError(error: Error, context: LogContext = {}, request?: any) {
    const correlationId = context.correlationId || getCorrelationId(request);
    this.print('error', error.message, {
      ...context,
      correlationId,
      error: error.name,
      stack: error.stack,
    });
  }

  private print(level: LogLevel, message: any, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...context,
    };

    // In production, you might want to use a structured logging library like Winston
    const logString = JSON.stringify(logEntry);
    
    switch (level) {
      case 'error':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'debug':
      case 'verbose':
        if (process.env.NODE_ENV !== 'production') {
          console.log(logString);
        }
        break;
      default:
        console.log(logString);
    }
  }
}

// Factory function to create logger with context
export function createLogger(context: string): EnhancedLogger {
  return new EnhancedLogger(context);
}
