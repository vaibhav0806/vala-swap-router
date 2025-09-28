import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { SwapException } from '../exceptions/swap.exception';

@Catch()
export class SwapExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SwapExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    if (exception instanceof SwapException) {
      status = exception.getStatus();
      errorResponse = {
        ...errorResponse,
        statusCode: status,
        errorCode: exception.errorCode,
        message: exception.message,
        details: exception.details,
      };

      // Log business logic errors as warnings, not errors
      this.logger.warn(`SwapException: ${exception.errorCode}`, {
        path: request.url,
        method: request.method,
        errorCode: exception.errorCode,
        details: exception.details,
      });
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      errorResponse = {
        ...errorResponse,
        statusCode: status,
        ...((typeof exceptionResponse === 'object') ? exceptionResponse : { message: exceptionResponse }),
      };

      this.logger.warn(`HttpException: ${status}`, {
        path: request.url,
        method: request.method,
        response: exceptionResponse,
      });
    } else {
      // Unexpected errors
      errorResponse = {
        ...errorResponse,
        statusCode: 500,
        message: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      };

      this.logger.error('Unexpected error:', exception, {
        path: request.url,
        method: request.method,
      });
    }

    response.status(status).json(errorResponse);
  }
}
