export enum ErrorCode {
  // Route related errors
  ROUTE_EXPIRED = 'ROUTE_EXPIRED',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  ROUTE_CALCULATION_FAILED = 'ROUTE_CALCULATION_FAILED',
  
  // Slippage related errors
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  
  // Token related errors
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  TOKEN_NOT_SUPPORTED = 'TOKEN_NOT_SUPPORTED',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  
  // Amount related errors
  AMOUNT_TOO_SMALL = 'AMOUNT_TOO_SMALL',
  AMOUNT_TOO_LARGE = 'AMOUNT_TOO_LARGE',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  
  // Transaction related errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  
  // DEX related errors
  DEX_UNAVAILABLE = 'DEX_UNAVAILABLE',
  DEX_RATE_LIMITED = 'DEX_RATE_LIMITED',
  DEX_INVALID_RESPONSE = 'DEX_INVALID_RESPONSE',
  
  // System errors
  CACHE_ERROR = 'CACHE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  
  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  
  // Security errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.ROUTE_EXPIRED]: 'The route has expired and is no longer valid',
  [ErrorCode.ROUTE_NOT_FOUND]: 'No valid route found for the given parameters',
  [ErrorCode.ROUTE_CALCULATION_FAILED]: 'Failed to calculate route',
  
  [ErrorCode.SLIPPAGE_EXCEEDED]: 'Transaction would exceed maximum slippage tolerance',
  [ErrorCode.SLIPPAGE_TOO_HIGH]: 'Slippage tolerance is too high',
  
  [ErrorCode.TOKEN_NOT_FOUND]: 'Token not found',
  [ErrorCode.TOKEN_NOT_SUPPORTED]: 'Token is not supported on this chain',
  [ErrorCode.INSUFFICIENT_LIQUIDITY]: 'Insufficient liquidity for this trade size',
  
  [ErrorCode.AMOUNT_TOO_SMALL]: 'Amount is below minimum trade size',
  [ErrorCode.AMOUNT_TOO_LARGE]: 'Amount exceeds maximum trade size',
  [ErrorCode.INVALID_AMOUNT]: 'Invalid amount specified',
  
  [ErrorCode.TRANSACTION_FAILED]: 'Transaction execution failed',
  [ErrorCode.TRANSACTION_TIMEOUT]: 'Transaction timed out',
  [ErrorCode.INSUFFICIENT_BALANCE]: 'Insufficient balance for transaction',
  
  [ErrorCode.DEX_UNAVAILABLE]: 'DEX service is currently unavailable',
  [ErrorCode.DEX_RATE_LIMITED]: 'DEX rate limit exceeded',
  [ErrorCode.DEX_INVALID_RESPONSE]: 'Invalid response from DEX',
  
  [ErrorCode.CACHE_ERROR]: 'Cache service error',
  [ErrorCode.DATABASE_ERROR]: 'Database operation failed',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCode.CIRCUIT_BREAKER_OPEN]: 'Service circuit breaker is open',
  
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing',
  [ErrorCode.VALIDATION_FAILED]: 'Input validation failed',
  
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized access',
  [ErrorCode.FORBIDDEN]: 'Access forbidden',
};
