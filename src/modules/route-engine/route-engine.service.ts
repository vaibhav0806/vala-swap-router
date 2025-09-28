import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from 'decimal.js';
import {
  RouteEngine,
  RouteRequest,
  BestRouteResponse,
  RouteScore,
  ProviderQuote,
  RouteEngineConfig,
} from '../../common/interfaces/route-engine.interface';
import { QuoteResponse } from '../../common/interfaces/dex-adapter.interface';
import { JupiterAdapter } from '../adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from '../adapters/okx/okx.adapter';
import { CacheService } from '../cache/cache.service';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';
import { MetricsService } from '../metrics/metrics.service';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';
import { CircuitBreakerDexAdapter } from '../../common/services/circuit-breaker-dex-adapter';

@Injectable()
export class RouteEngineService implements RouteEngine {
  private readonly logger = new Logger(RouteEngineService.name);
  private readonly config: RouteEngineConfig;
  private readonly jupiterCircuitBreaker: CircuitBreakerDexAdapter;
  private readonly okxCircuitBreaker: CircuitBreakerDexAdapter;

  constructor(
    private configService: ConfigService,
    private jupiterAdapter: JupiterAdapter,
    private okxAdapter: OkxAdapter,
    private cacheService: CacheService,
    private metricsService: MetricsService,
    private circuitBreakerService: CircuitBreakerService, // Add this
  ) {
    this.config = {
      performanceWeights: this.configService.get('dex.performanceWeights') || {
        outputAmount: 0.4,
        fees: 0.25,
        gasEstimate: 0.15,
        latency: 0.15,
        reliability: 0.05,
      },
      routeExpirationMs: this.configService.get('dex.routeExpirationMs') || 30000,
      maxAlternatives: 3,
      enableCaching: true,
    };

    // Wrap adapters with circuit breakers
    this.jupiterCircuitBreaker = new CircuitBreakerDexAdapter(
      this.jupiterAdapter,
      this.circuitBreakerService,
      'jupiter'
    );

    this.okxCircuitBreaker = new CircuitBreakerDexAdapter(
      this.okxAdapter,
      this.circuitBreakerService,
      'okx'
    );
  }

  async findBestRoute(request: RouteRequest): Promise<BestRouteResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    this.logger.debug('Finding best route', { requestId, request });

    try {
      // Generate cache key for request coalescing
      const cacheKey = this.cacheService.generateRouteKey(
        request.inputMint,
        request.outputMint,
        request.amount,
      );

      // Use request coalescing to prevent duplicate requests
      const result = await this.cacheService.getWithCoalescing(
        cacheKey,
        () => this.executeRouteCalculation(request, requestId),
        this.config.routeExpirationMs,
        8000 // 8 second timeout for route calculation
      );

      // Update the result with current request ID and timing
      return {
        ...result,
        requestId,
        totalResponseTime: Date.now() - startTime,
      };

    } catch (error) {
      this.metricsService.trackError(
        error.errorCode || 'UNKNOWN_ERROR',
        undefined,
        'findBestRoute'
      );
      
      this.logger.error('Failed to find best route', { requestId, error });
      throw error;
    }
  }

  calculateRouteScore(quote: QuoteResponse, responseTime: number): RouteScore {
    const weights = this.config.performanceWeights;
    
    // Normalize values to 0-1 scale for scoring
    const outputAmount = this.normalizeOutputAmount(quote.outAmount);
    const fees = this.normalizeFees(quote.platformFee?.amount || '0', quote.inAmount);
    const gasEstimate = this.normalizeGasEstimate(100000); // Default gas estimate
    const latency = this.normalizeLatency(responseTime);
    const reliability = this.getProviderReliability(quote);

    // Calculate weighted score (higher is better)
    const totalScore = 
      (outputAmount * weights.outputAmount) +
      ((1 - fees) * weights.fees) + // Invert fees (lower fees = higher score)
      ((1 - gasEstimate) * weights.gasEstimate) + // Invert gas (lower gas = higher score)
      ((1 - latency) * weights.latency) + // Invert latency (lower latency = higher score)
      (reliability * weights.reliability);

    return {
      outputAmount,
      fees,
      gasEstimate,
      latency,
      reliability,
      totalScore,
    };
  }

  getConfig(): RouteEngineConfig {
    return this.config;
  }

  private async executeRouteCalculation(request: RouteRequest, requestId: string): Promise<BestRouteResponse> {
    const startTime = Date.now();
    
    this.logger.debug('Executing route calculation (not coalesced)', { requestId, request });

    // Check cache first (for the actual execution)
    const cacheKey = this.cacheService.generateRouteKey(
      request.inputMint,
      request.outputMint,
      request.amount,
    );

    let cachedResult: BestRouteResponse | null = null;
    if (this.config.enableCaching) {
      cachedResult = await this.cacheService.get<BestRouteResponse>(cacheKey);
      if (cachedResult && this.isRouteValid(cachedResult.bestRoute)) {
        this.logger.debug('Returning cached route from execution', { requestId });
        return {
          ...cachedResult,
          requestId,
          cacheHitRatio: 1.0,
        };
      }
    }

    // Fetch quotes from all providers in parallel with coalescing
    const quotes = await this.fetchQuotesWithCoalescing(request);

    if (quotes.length === 0) {
      this.metricsService.trackError('ROUTE_NOT_FOUND', undefined, 'findBestRoute');
      throw new SwapException(ErrorCode.ROUTE_NOT_FOUND, {
        requestId,
        request,
      });
    }

    // Calculate scores for each quote
    const scoredQuotes = quotes.map(quote => {
      const score = this.calculateRouteScore(quote, quote.responseTime);
      
      // Track route score metrics
      this.metricsService.trackRouteScore(quote.provider, score.totalScore);
      
      return {
        ...quote,
        score,
      };
    });

    // Apply policy preferences
    const rankedQuotes = this.applyRoutingPolicy(scoredQuotes, request);

    // Select best route and alternatives
    const bestRoute = rankedQuotes[0];
    const alternatives = rankedQuotes.slice(1, this.config.maxAlternatives + 1);

    const result: BestRouteResponse = {
      bestRoute,
      alternatives,
      requestId,
      totalResponseTime: Date.now() - startTime,
      cacheHitRatio: cachedResult ? 0.5 : 0.0,
    };

    // Track successful quote
    this.metricsService.trackQuote(
      request.inputMint,
      request.outputMint,
      bestRoute.provider,
      'success'
    );

    this.logger.debug('Route calculation completed', {
      requestId,
      provider: bestRoute.provider,
      outputAmount: bestRoute.outAmount,
      score: bestRoute.score.totalScore,
      totalTime: result.totalResponseTime,
    });

    return result;
  }

  private async fetchQuotesWithCoalescing(request: RouteRequest): Promise<ProviderQuote[]> {
    const quoteRequest = {
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amount,
      slippageBps: request.slippageBps,
      userPublicKey: request.userPublicKey,
    };

    // Create coalesced quote requests for each provider
    const jupiterPromise = this.fetchProviderQuoteWithCoalescing('jupiter', quoteRequest);
    const okxPromise = this.fetchProviderQuoteWithCoalescing('okx', quoteRequest);

    // Wait for all provider quotes
    const results = await Promise.allSettled([jupiterPromise, okxPromise]);
    // const results = await Promise.allSettled([jupiterPromise]);
    
    return results
      .filter((result): result is PromiseFulfilledResult<ProviderQuote> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  private async fetchProviderQuoteWithCoalescing(
    provider: string, 
    quoteRequest: any
  ): Promise<ProviderQuote> {
    // Generate a cache key specific to this provider and request
    const providerCacheKey = `provider_quote:${provider}:${quoteRequest.inputMint}:${quoteRequest.outputMint}:${quoteRequest.amount}:${quoteRequest.slippageBps || 50}`;
    
    return this.cacheService.getWithCoalescing(
      providerCacheKey,
      () => this.executeProviderQuote(provider, quoteRequest),
      15000, // Cache provider quotes for 15 seconds
      5000   // 5 second timeout for provider quotes
    );
  }

  private async executeProviderQuote(provider: string, quoteRequest: any): Promise<ProviderQuote> {
    const startTime = Date.now();
    
    try {
      let quote: QuoteResponse;
      
      if (provider === 'jupiter') {
        quote = await this.jupiterCircuitBreaker.getQuote(quoteRequest);
      } else if (provider === 'okx') {
        quote = await this.okxCircuitBreaker.getQuote(quoteRequest);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
      
      const responseTime = Date.now() - startTime;
      
      // Track successful provider quote
      this.metricsService.trackProviderQuote(provider, 'success', responseTime);
      
      return {
        ...quote,
        provider,
        responseTime,
        score: { outputAmount: 0, fees: 0, gasEstimate: 0, latency: 0, reliability: 0, totalScore: 0 },
        isCached: false,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Track failed provider quote
      this.metricsService.trackProviderQuote(provider, 'error', responseTime);
      
      // Check if it's a circuit breaker error
      if (error.errorCode === ErrorCode.CIRCUIT_BREAKER_OPEN) {
        this.logger.warn(`Provider ${provider} circuit breaker is open, skipping`);
        this.metricsService.trackError('CIRCUIT_BREAKER_OPEN', provider, 'getQuote');
      } else {
        this.metricsService.trackError(
          error.errorCode || 'PROVIDER_ERROR',
          provider,
          'getQuote'
        );
        this.logger.warn(`Failed to get quote from ${provider}:`, error.message);
      }
      
      throw error;
    }
  }

  private applyRoutingPolicy(quotes: ProviderQuote[], request: RouteRequest): ProviderQuote[] {
    if (request.favorLowLatency) {
      // Prioritize latency over output amount when favorLowLatency is true
      return quotes.sort((a, b) => {
        const aLatencyScore = (1 - a.score.latency) * 0.6 + a.score.outputAmount * 0.4;
        const bLatencyScore = (1 - b.score.latency) * 0.6 + b.score.outputAmount * 0.4;
        return bLatencyScore - aLatencyScore;
      });
    }

    // Default: sort by total score
    return quotes.sort((a, b) => b.score.totalScore - a.score.totalScore);
  }

  private normalizeOutputAmount(outAmount: string): number {
    // Normalize based on expected range - this would be more sophisticated in production
    // For now, we'll use a simple approach
    const amount = new Decimal(outAmount);
    const maxExpected = new Decimal('1000000000000'); // 1M with 6 decimals
    return Math.min(amount.div(maxExpected).toNumber(), 1);
  }

  private normalizeFees(feeAmount: string, inputAmount: string): number {
    if (feeAmount === '0' || inputAmount === '0') return 0;
    
    const fee = new Decimal(feeAmount);
    const input = new Decimal(inputAmount);
    const feeRatio = fee.div(input).toNumber();
    
    // Normalize to 0-1 scale, where 0.01 (1%) is considered high
    return Math.min(feeRatio / 0.01, 1);
  }

  private normalizeGasEstimate(gasEstimate: number): number {
    // Normalize gas estimate (example: 200k gas is considered high)
    const maxGas = 200000;
    return Math.min(gasEstimate / maxGas, 1);
  }

  private normalizeLatency(responseTime: number): number {
    // Normalize latency (example: 3000ms is considered high)
    const maxLatency = 3000;
    return Math.min(responseTime / maxLatency, 1);
  }

  private getProviderReliability(quote: QuoteResponse): number {
    // Simple reliability scoring based on historical data
    // In production, this would be based on actual success rates
    const providerReliability = {
      'Jupiter': 0.95,
      'OKX': 0.90,
    };

    return providerReliability['Jupiter'] || 0.85; // Default reliability
  }

  private isRouteValid(route: ProviderQuote): boolean {
    if (!route.timeTaken) return false;
    
    const now = Date.now();
    const routeAge = now - route.timeTaken;
    return routeAge < this.config.routeExpirationMs;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
