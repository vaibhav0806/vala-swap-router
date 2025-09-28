import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessages } from '../enums/error-codes.enum';

export class SwapException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly details?: any,
    statusCode?: HttpStatus,
  ) {
    const message = ErrorMessages[errorCode] || 'Unknown error';
    const status = statusCode || SwapException.getStatusForErrorCode(errorCode);
    
    super(
      {
        errorCode,
        message,
        details,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }

  private static getStatusForErrorCode(errorCode: ErrorCode): HttpStatus {
    switch (errorCode) {
      case ErrorCode.ROUTE_EXPIRED:
      case ErrorCode.SLIPPAGE_EXCEEDED:
      case ErrorCode.ROUTE_NOT_FOUND:
        return HttpStatus.CONFLICT;
      
      case ErrorCode.TOKEN_NOT_FOUND:
      case ErrorCode.ROUTE_CALCULATION_FAILED:
        return HttpStatus.NOT_FOUND;
      
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.MISSING_REQUIRED_FIELD:
      case ErrorCode.VALIDATION_FAILED:
      case ErrorCode.AMOUNT_TOO_SMALL:
      case ErrorCode.AMOUNT_TOO_LARGE:
      case ErrorCode.INVALID_AMOUNT:
      case ErrorCode.SLIPPAGE_TOO_HIGH:
        return HttpStatus.BAD_REQUEST;
      
      case ErrorCode.INSUFFICIENT_BALANCE:
      case ErrorCode.INSUFFICIENT_LIQUIDITY:
        return HttpStatus.PAYMENT_REQUIRED;
      
      case ErrorCode.UNAUTHORIZED:
        return HttpStatus.UNAUTHORIZED;
      
      case ErrorCode.FORBIDDEN:
        return HttpStatus.FORBIDDEN;
      
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return HttpStatus.TOO_MANY_REQUESTS;
      
      case ErrorCode.DEX_UNAVAILABLE:
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
      case ErrorCode.CIRCUIT_BREAKER_OPEN:
        return HttpStatus.SERVICE_UNAVAILABLE;
      
      case ErrorCode.TRANSACTION_TIMEOUT:
        return HttpStatus.REQUEST_TIMEOUT;
      
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.CACHE_ERROR:
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
