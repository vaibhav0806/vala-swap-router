import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../modules/metrics/metrics.service';

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

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitBreakerStats>();
  private readonly configs = new Map<string, CircuitBreakerConfig>();

  constructor(
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {}

  /**
   * Register a circuit breaker for a service
   */
  registerCircuit(
    serviceName: string, 
    config?: Partial<CircuitBreakerConfig>
  ): void {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: this.configService.get('app.circuitBreakerThreshold', 5),
      recoveryTimeout: this.configService.get('app.circuitBreakerTimeout', 60000),
      successThreshold: 3,
      monitoringWindow: 60000, // 1 minute
    };

    const finalConfig = { ...defaultConfig, ...config };
    this.configs.set(serviceName, finalConfig);
    
    this.circuits.set(serviceName, {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
    });

    this.logger.log(`Circuit breaker registered for ${serviceName}`, finalConfig);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuit = this.circuits.get(serviceName);
    const config = this.configs.get(serviceName);

    if (!circuit || !config) {
      throw new Error(`Circuit breaker not registered for service: ${serviceName}`);
    }

    // Check if circuit is open and should remain open
    if (circuit.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset(circuit, config)) {
        this.transitionToHalfOpen(serviceName, circuit);
      } else {
        this.metricsService.trackCircuitBreakerState(serviceName, 'open');
        
        if (fallback) {
          this.logger.warn(`Circuit breaker OPEN for ${serviceName}, using fallback`);
          return await fallback();
        }
        
        throw new Error(`Circuit breaker is OPEN for service: ${serviceName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess(serviceName, circuit, config);
      return result;
    } catch (error) {
      this.onFailure(serviceName, circuit, config, error);
      
      // If circuit just opened and we have fallback, use it
      if (circuit.state === CircuitBreakerState.OPEN && fallback) {
        this.logger.warn(`Circuit breaker opened for ${serviceName}, using fallback`);
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Get current state of a circuit breaker
   */
  getCircuitState(serviceName: string): CircuitBreakerStats | null {
    return this.circuits.get(serviceName) || null;
  }

  /**
   * Get all circuit breaker states
   */
  getAllCircuitStates(): Record<string, CircuitBreakerStats> {
    const states: Record<string, CircuitBreakerStats> = {};
    for (const [name, stats] of this.circuits.entries()) {
      states[name] = { ...stats };
    }
    return states;
  }

  /**
   * Manually reset a circuit breaker (for admin/testing purposes)
   */
  resetCircuit(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.state = CircuitBreakerState.CLOSED;
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.lastFailureTime = undefined;
      circuit.nextAttemptTime = undefined;
      
      this.logger.log(`Circuit breaker manually reset for ${serviceName}`);
      this.metricsService.trackCircuitBreakerState(serviceName, 'reset');
    }
  }

  private shouldAttemptReset(circuit: CircuitBreakerStats, config: CircuitBreakerConfig): boolean {
    if (!circuit.nextAttemptTime) {
      return true;
    }
    return Date.now() >= circuit.nextAttemptTime;
  }

  private transitionToHalfOpen(serviceName: string, circuit: CircuitBreakerStats): void {
    circuit.state = CircuitBreakerState.HALF_OPEN;
    circuit.successCount = 0;
    circuit.nextAttemptTime = undefined;
    
    this.logger.log(`Circuit breaker transitioning to HALF_OPEN for ${serviceName}`);
    this.metricsService.trackCircuitBreakerState(serviceName, 'half_open');
  }

  private onSuccess(serviceName: string, circuit: CircuitBreakerStats, config: CircuitBreakerConfig): void {
    circuit.lastSuccessTime = Date.now();
    
    if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      circuit.successCount++;
      
      if (circuit.successCount >= config.successThreshold) {
        // Reset to closed state
        circuit.state = CircuitBreakerState.CLOSED;
        circuit.failureCount = 0;
        circuit.successCount = 0;
        
        this.logger.log(`Circuit breaker CLOSED for ${serviceName} after recovery`);
        this.metricsService.trackCircuitBreakerState(serviceName, 'closed');
      }
    } else if (circuit.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      circuit.failureCount = Math.max(0, circuit.failureCount - 1);
    }

    this.metricsService.trackCircuitBreakerOperation(serviceName, 'success');
  }

  private onFailure(
    serviceName: string, 
    circuit: CircuitBreakerStats, 
    config: CircuitBreakerConfig,
    error: any
  ): void {
    circuit.lastFailureTime = Date.now();
    circuit.failureCount++;

    this.logger.warn(`Circuit breaker failure for ${serviceName}:`, {
      failureCount: circuit.failureCount,
      threshold: config.failureThreshold,
      error: error.message,
    });

    // Check if we should open the circuit
    if (circuit.state === CircuitBreakerState.CLOSED && 
        circuit.failureCount >= config.failureThreshold) {
      
      circuit.state = CircuitBreakerState.OPEN;
      circuit.nextAttemptTime = Date.now() + config.recoveryTimeout;
      
      this.logger.error(`Circuit breaker OPENED for ${serviceName}`, {
        failureCount: circuit.failureCount,
        nextAttemptTime: new Date(circuit.nextAttemptTime).toISOString(),
      });
      
      this.metricsService.trackCircuitBreakerState(serviceName, 'open');
    } else if (circuit.state === CircuitBreakerState.HALF_OPEN) {
      // Failure in half-open state goes back to open
      circuit.state = CircuitBreakerState.OPEN;
      circuit.nextAttemptTime = Date.now() + config.recoveryTimeout;
      circuit.successCount = 0;
      
      this.logger.warn(`Circuit breaker back to OPEN for ${serviceName} after half-open failure`);
      this.metricsService.trackCircuitBreakerState(serviceName, 'open');
    }

    this.metricsService.trackCircuitBreakerOperation(serviceName, 'failure');
  }
}
