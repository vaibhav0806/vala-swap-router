import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // Request metrics
  private readonly requestDuration: Histogram<string>;
  private readonly requestTotal: Counter<string>;
  private readonly requestErrors: Counter<string>;

  // Cache metrics
  private readonly cacheHits: Counter<string>;
  private readonly cacheMisses: Counter<string>;
  private readonly cacheOperationDuration: Histogram<string>;

  // Business metrics
  private readonly quotesTotal: Counter<string>;
  private readonly swapsTotal: Counter<string>;
  private readonly providerQuoteDuration: Histogram<string>;
  private readonly providerAvailability: Gauge<string>;
  private readonly routeScores: Histogram<string>;

  // System metrics
  private readonly activeConnections: Gauge<string>;
  private readonly databaseConnections: Gauge<string>;

  // Circuit breaker metrics
  private circuitBreakerStateGauge: Gauge<string>;
  private circuitBreakerStateChanges: Counter<string>;
  private circuitBreakerOperations: Counter<string>;

  constructor() {
    // Initialize request metrics
    this.requestDuration = new Histogram({
      name: 'vala_swap_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.35, 0.5, 1, 2, 5], // Focus on sub-350ms target
    });

    this.requestTotal = new Counter({
      name: 'vala_swap_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.requestErrors = new Counter({
      name: 'vala_swap_errors_total',
      help: 'Total number of errors by type',
      labelNames: ['error_code', 'provider', 'operation'],
    });

    // Initialize cache metrics
    this.cacheHits = new Counter({
      name: 'vala_swap_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type', 'operation'],
    });

    this.cacheMisses = new Counter({
      name: 'vala_swap_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type', 'operation'],
    });

    this.cacheOperationDuration = new Histogram({
      name: 'vala_swap_cache_operation_duration_seconds',
      help: 'Duration of cache operations in seconds',
      labelNames: ['operation', 'result'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
    });

    // Initialize business metrics
    this.quotesTotal = new Counter({
      name: 'vala_swap_quotes_total',
      help: 'Total number of quotes requested',
      labelNames: ['input_token', 'output_token', 'provider', 'result'],
    });

    this.swapsTotal = new Counter({
      name: 'vala_swap_swaps_total',
      help: 'Total number of swap transactions',
      labelNames: ['provider', 'status', 'input_token', 'output_token'],
    });

    this.providerQuoteDuration = new Histogram({
      name: 'vala_swap_provider_quote_duration_seconds',
      help: 'Duration of quote requests to providers',
      labelNames: ['provider', 'result'],
      buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5],
    });

    this.providerAvailability = new Gauge({
      name: 'vala_swap_provider_availability',
      help: 'Provider availability status (1 = healthy, 0 = unhealthy)',
      labelNames: ['provider'],
    });

    this.routeScores = new Histogram({
      name: 'vala_swap_route_scores',
      help: 'Distribution of route scores',
      labelNames: ['provider'],
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    });

    // Initialize system metrics
    this.activeConnections = new Gauge({
      name: 'vala_swap_active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
    });

    this.databaseConnections = new Gauge({
      name: 'vala_swap_database_connections',
      help: 'Number of database connections',
      labelNames: ['state'],
    });

    // Circuit breaker metrics
    this.circuitBreakerStateGauge = new Gauge({
      name: 'vala_swap_circuit_breaker_state',
      help: 'Current state of circuit breakers (0=closed, 1=half_open, 2=open)',
      labelNames: ['service'],
    });

    this.circuitBreakerStateChanges = new Counter({
      name: 'vala_swap_circuit_breaker_state_changes_total',
      help: 'Total number of circuit breaker state changes',
      labelNames: ['service', 'state'],
    });

    this.circuitBreakerOperations = new Counter({
      name: 'vala_swap_circuit_breaker_operations_total',
      help: 'Total number of operations through circuit breakers',
      labelNames: ['service', 'result'],
    });

    // Register all metrics
    register.registerMetric(this.requestDuration);
    register.registerMetric(this.requestTotal);
    register.registerMetric(this.requestErrors);
    register.registerMetric(this.cacheHits);
    register.registerMetric(this.cacheMisses);
    register.registerMetric(this.cacheOperationDuration);
    register.registerMetric(this.quotesTotal);
    register.registerMetric(this.swapsTotal);
    register.registerMetric(this.providerQuoteDuration);
    register.registerMetric(this.providerAvailability);
    register.registerMetric(this.routeScores);
    register.registerMetric(this.activeConnections);
    register.registerMetric(this.databaseConnections);
    register.registerMetric(this.circuitBreakerStateGauge);
    register.registerMetric(this.circuitBreakerStateChanges);
    register.registerMetric(this.circuitBreakerOperations);

    this.logger.log('Prometheus metrics initialized');
  }

  // Request tracking methods
  trackRequest(method: string, route: string, statusCode: number, duration: number): void {
    const durationInSeconds = duration / 1000;
    
    this.requestDuration
      .labels(method, route, statusCode.toString())
      .observe(durationInSeconds);
    
    this.requestTotal
      .labels(method, route, statusCode.toString())
      .inc();
  }

  trackError(errorCode: string, provider?: string, operation?: string): void {
    this.requestErrors
      .labels(errorCode, provider || 'unknown', operation || 'unknown')
      .inc();
  }

  // Cache tracking methods
  trackCacheHit(cacheType: string, operation: string): void {
    this.cacheHits.labels(cacheType, operation).inc();
  }

  trackCacheMiss(cacheType: string, operation: string): void {
    this.cacheMisses.labels(cacheType, operation).inc();
  }

  trackCacheOperation(operation: string, result: 'success' | 'error', duration: number): void {
    const durationInSeconds = duration / 1000;
    this.cacheOperationDuration
      .labels(operation, result)
      .observe(durationInSeconds);
  }

  // Business metrics methods
  trackQuote(inputToken: string, outputToken: string, provider: string, result: 'success' | 'error'): void {
    // Simplified token names for metrics (first 8 chars)
    const inputTokenShort = inputToken.substring(0, 8);
    const outputTokenShort = outputToken.substring(0, 8);
    
    this.quotesTotal
      .labels(inputTokenShort, outputTokenShort, provider, result)
      .inc();
  }

  trackSwap(provider: string, status: string, inputToken: string, outputToken: string): void {
    const inputTokenShort = inputToken.substring(0, 8);
    const outputTokenShort = outputToken.substring(0, 8);
    
    this.swapsTotal
      .labels(provider, status, inputTokenShort, outputTokenShort)
      .inc();
  }

  trackProviderQuote(provider: string, result: 'success' | 'error', duration: number): void {
    const durationInSeconds = duration / 1000;
    this.providerQuoteDuration
      .labels(provider, result)
      .observe(durationInSeconds);
  }

  updateProviderAvailability(provider: string, isHealthy: boolean): void {
    this.providerAvailability
      .labels(provider)
      .set(isHealthy ? 1 : 0);
  }

  trackRouteScore(provider: string, score: number): void {
    this.routeScores
      .labels(provider)
      .observe(score);
  }

  // System metrics methods
  updateActiveConnections(type: string, count: number): void {
    this.activeConnections.labels(type).set(count);
  }

  updateDatabaseConnections(state: string, count: number): void {
    this.databaseConnections.labels(state).set(count);
  }

  /**
   * Track circuit breaker state changes
   */
  trackCircuitBreakerState(serviceName: string, state: string): void {
    this.circuitBreakerStateGauge.set({ service: serviceName }, state === 'closed' ? 0 : state === 'half_open' ? 1 : 2);
    this.circuitBreakerStateChanges.inc({ service: serviceName, state });
  }

  /**
   * Track circuit breaker operations
   */
  trackCircuitBreakerOperation(serviceName: string, result: 'success' | 'failure'): void {
    this.circuitBreakerOperations.inc({ service: serviceName, result });
  }

  // Utility method to calculate cache hit ratio
  async calculateCacheHitRatio(cacheType: string): Promise<number> {
    try {
      const hitsMetric = await this.cacheHits.get();
      const missesMetric = await this.cacheMisses.get();
      
      const hits = hitsMetric.values.find(
        metric => metric.labels.cache_type === cacheType
      )?.value || 0;
      
      const misses = missesMetric.values.find(
        metric => metric.labels.cache_type === cacheType
      )?.value || 0;
      
      const total = hits + misses;
      return total > 0 ? hits / total : 0;
    } catch (error) {
      this.logger.warn('Failed to calculate cache hit ratio:', error);
      return 0;
    }
  }

  // Method to get current metrics summary for debugging
  async getMetricsSummary(): Promise<any> {
    try {
      return {
        requests: await this.requestTotal.get(),
        errors: await this.requestErrors.get(),
        cacheHits: await this.cacheHits.get(),
        cacheMisses: await this.cacheMisses.get(),
        quotes: await this.quotesTotal.get(),
        swaps: await this.swapsTotal.get(),
      };
    } catch (error) {
      this.logger.error('Failed to get metrics summary:', error);
      return {};
    }
  }
}
