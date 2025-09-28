import { Logger } from '@nestjs/common';
import { DexAdapter, QuoteRequest, QuoteResponse, BuildTransactionRequest, BuildTransactionResponse, SimulateTransactionRequest, SimulateTransactionResponse } from '../interfaces/dex-adapter.interface';
import { CircuitBreakerService } from './circuit-breaker.service';
import { SwapException } from '../exceptions/swap.exception';
import { ErrorCode } from '../enums/error-codes.enum';

export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing fast
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening
  recoveryTimeout: number;     // Time to wait before trying half-open (ms)
  successThreshold: number;    // Successes needed in half-open to close
  monitoringWindow: number;    // Time window for failure counting (ms)
}

export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
}

export class CircuitBreakerDexAdapter implements DexAdapter {
  private readonly logger = new Logger(CircuitBreakerDexAdapter.name);

  constructor(
    private readonly wrappedAdapter: DexAdapter,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly serviceName: string,
  ) {
    // Register circuit breakers for each operation type
    this.circuitBreakerService.registerCircuit(`${serviceName}_quote`, {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      successThreshold: 2,
      monitoringWindow: 60000,
    });
    
    this.circuitBreakerService.registerCircuit(`${serviceName}_build`, {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      successThreshold: 2,
      monitoringWindow: 60000,
    });
    
    this.circuitBreakerService.registerCircuit(`${serviceName}_simulate`, {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      successThreshold: 2,
      monitoringWindow: 60000,
    });
    
    this.circuitBreakerService.registerCircuit(`${serviceName}_health`, {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      successThreshold: 2,
      monitoringWindow: 60000,
    });
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    return this.circuitBreakerService.execute(
      `${this.serviceName}_quote`,
      () => this.wrappedAdapter.getQuote(request),
      () => this.getQuoteFallback(request)
    );
  }

  async buildTransaction(request: BuildTransactionRequest): Promise<BuildTransactionResponse> {
    return this.circuitBreakerService.execute(
      `${this.serviceName}_build`,
      () => this.wrappedAdapter.buildTransaction(request),
      () => this.buildTransactionFallback(request)
    );
  }

  async simulateTransaction(request: SimulateTransactionRequest): Promise<SimulateTransactionResponse> {
    return this.circuitBreakerService.execute(
      `${this.serviceName}_simulate`,
      () => this.wrappedAdapter.simulateTransaction(request)
    );
  }

  getName(): string {
    return `CircuitBreaker(${this.wrappedAdapter.getName()})`;
  }

  async isHealthy(): Promise<boolean> {
    try {
      return await this.circuitBreakerService.execute(
        `${this.serviceName}_health`,
        () => this.wrappedAdapter.isHealthy(),
        () => Promise.resolve(false)
      );
    } catch {
      return false;
    }
  }

  private async getQuoteFallback(request: QuoteRequest): Promise<QuoteResponse> {
    throw new SwapException(ErrorCode.CIRCUIT_BREAKER_OPEN, {
      provider: this.serviceName,
      operation: 'getQuote',
    });
  }

  private async buildTransactionFallback(request: BuildTransactionRequest): Promise<BuildTransactionResponse> {
    throw new SwapException(ErrorCode.CIRCUIT_BREAKER_OPEN, {
      provider: this.serviceName,
      operation: 'buildTransaction',
    });
  }
}
