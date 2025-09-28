import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Decimal } from 'decimal.js';
import { Quote, QuoteProvider } from '../../database/entities/quote.entity';
import { RouteEngineService } from '../route-engine/route-engine.service';
import { TokensService } from '../tokens/tokens.service';
import { CacheService } from '../cache/cache.service';
import { GetQuoteDto, QuoteResponseDto, ProviderQuoteDto, RouteScoreDto } from './dto/quote.dto';
import { RouteRequest } from '../../common/interfaces/route-engine.interface';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    private routeEngineService: RouteEngineService,
    private tokensService: TokensService,
    private cacheService: CacheService,
  ) {}

  async getQuote(request: GetQuoteDto): Promise<QuoteResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Getting quote', { request });

      // Validate token pair
      await this.tokensService.validateTokenPair(request.inputMint, request.outputMint);

      // Validate amount
      this.validateAmount(request.amount);

      // Generate cache key for the complete quote request
      const quoteCacheKey = this.cacheService.generateQuoteKey(
        request.inputMint,
        request.outputMint,
        request.amount,
        request.slippageBps || 50
      );

      // Use request coalescing for the entire quote operation
      const result = await this.cacheService.getWithCoalescing(
        quoteCacheKey,
        () => this.executeQuoteRequest(request),
        30000, // Cache quotes for 30 seconds
        10000  // 10 second timeout for quote requests
      );

      // Update timing information
      result.totalResponseTime = Date.now() - startTime;

      this.logger.debug('Quote completed', {
        requestId: result.requestId,
        provider: result.bestRoute.provider,
        outputAmount: result.bestRoute.outAmount,
        totalTime: result.totalResponseTime,
        coalesced: result.totalResponseTime < 100 // Likely coalesced if very fast
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to get quote:', error);
      
      if (error instanceof SwapException) {
        throw error;
      }

      throw new SwapException(ErrorCode.ROUTE_CALCULATION_FAILED, {
        request,
        error: error.message,
        totalTime: Date.now() - startTime,
      });
    }
  }

  async getQuoteById(id: string): Promise<Quote | null> {
    try {
      return await this.quoteRepository.findOne({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to get quote ${id}:`, error);
      throw new SwapException(ErrorCode.DATABASE_ERROR, {
        operation: 'getQuoteById',
        id,
        error: error.message,
      });
    }
  }

  private validateAmount(amount: string): void {
    try {
      const amountDecimal = new Decimal(amount);
      
      if (amountDecimal.lte(0)) {
        throw new SwapException(ErrorCode.INVALID_AMOUNT, {
          amount,
          reason: 'Amount must be positive',
        });
      }

      // Check minimum amount (e.g., 1 lamport)
      if (amountDecimal.lt(1)) {
        throw new SwapException(ErrorCode.AMOUNT_TOO_SMALL, {
          amount,
          minimum: '1',
        });
      }

      // Check maximum amount (prevent overflow)
      const maxAmount = new Decimal('18446744073709551615'); // u64 max
      if (amountDecimal.gt(maxAmount)) {
        throw new SwapException(ErrorCode.AMOUNT_TOO_LARGE, {
          amount,
          maximum: maxAmount.toString(),
        });
      }
    } catch (error) {
      if (error instanceof SwapException) {
        throw error;
      }
      
      throw new SwapException(ErrorCode.INVALID_AMOUNT, {
        amount,
        error: error.message,
      });
    }
  }

  private transformToProviderQuoteDto(providerQuote: any): ProviderQuoteDto {
    return {
      inputMint: providerQuote.inputMint,
      outputMint: providerQuote.outputMint,
      inAmount: providerQuote.inAmount,
      outAmount: providerQuote.outAmount,
      otherAmountThreshold: providerQuote.otherAmountThreshold,
      swapMode: providerQuote.swapMode,
      slippageBps: providerQuote.slippageBps,
      platformFee: providerQuote.platformFee,
      priceImpactPct: providerQuote.priceImpactPct,
      routePlan: providerQuote.routePlan?.map(step => ({
        ammKey: step.swapInfo.ammKey,
        label: step.swapInfo.label,
        inputMint: step.swapInfo.inputMint,
        outputMint: step.swapInfo.outputMint,
        inAmount: step.swapInfo.inAmount,
        outAmount: step.swapInfo.outAmount,
        feeAmount: step.swapInfo.feeAmount,
        feeMint: step.swapInfo.feeMint,
      })) || [],
      timeTaken: providerQuote.timeTaken,
      contextSlot: providerQuote.contextSlot,
      provider: providerQuote.provider,
      responseTime: providerQuote.responseTime,
      score: this.transformToRouteScoreDto(providerQuote.score),
      isCached: providerQuote.isCached,
    };
  }

  private transformToRouteScoreDto(score: any): RouteScoreDto {
    return {
      outputAmount: score.outputAmount,
      fees: score.fees,
      gasEstimate: score.gasEstimate,
      latency: score.latency,
      reliability: score.reliability,
      totalScore: score.totalScore,
    };
  }

  private calculateFeeBreakdown(quote: any): any {
    const platformFee = quote.platformFee?.amount || '0';
    const gasFee = '5000'; // Estimated gas fee in lamports
    
    const platformFeeDecimal = new Decimal(platformFee);
    const gasFeeDecimal = new Decimal(gasFee);
    const totalFeeDecimal = platformFeeDecimal.plus(gasFeeDecimal);
    const inputAmountDecimal = new Decimal(quote.inAmount);
    
    const feePercentage = inputAmountDecimal.gt(0) 
      ? totalFeeDecimal.div(inputAmountDecimal).mul(100).toFixed(4)
      : '0';

    return {
      platformFee,
      gasFee,
      totalFee: totalFeeDecimal.toString(),
      feePercentage,
    };
  }

  private async storeQuote(quote: any, requestId: string): Promise<string> {
    try {
      const quoteEntity = new Quote();
      quoteEntity.inputToken = quote.inputMint;
      quoteEntity.outputToken = quote.outputMint;
      quoteEntity.inputAmount = quote.inAmount;
      quoteEntity.outputAmount = quote.outAmount;
      quoteEntity.priceImpactPct = quote.priceImpactPct;
      quoteEntity.provider = quote.provider === 'Jupiter' ? QuoteProvider.JUPITER : QuoteProvider.OKX;
      quoteEntity.routePlan = quote.routePlan;
      quoteEntity.feeAmount = quote.platformFee?.amount || '0';
      quoteEntity.gasEstimate = '100000'; // Default estimate
      quoteEntity.responseTimeMs = quote.responseTime;
      quoteEntity.isCached = quote.isCached;
      quoteEntity.expiresAt = new Date(Date.now() + 30000); // 30 seconds
      quoteEntity.efficiencyScore = quote.score.totalScore.toString();
      quoteEntity.reliabilityScore = quote.score.reliability.toString();

      const savedQuote = await this.quoteRepository.save(quoteEntity);
      
      this.logger.debug(`Stored quote for analytics: ${savedQuote.id}`);
      return savedQuote.id;
    } catch (error) {
      // Don't fail the main request if analytics storage fails
      this.logger.warn('Failed to store quote for analytics:', error);
      // Return a temporary ID if storage fails
      return `temp_${requestId}`;
    }
  }

  private async executeQuoteRequest(request: GetQuoteDto): Promise<QuoteResponseDto> {
    const startTime = Date.now();
    
    this.logger.debug('Executing quote request (not coalesced)', { request });

    // Build route request
    const routeRequest: RouteRequest = {
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amount,
      slippageBps: request.slippageBps,
      userPublicKey: request.userPublicKey,
      favorLowLatency: request.favorLowLatency,
      maxRoutes: request.maxRoutes,
    };

    // Find best routes (this will use its own coalescing)
    const routeResponse = await this.routeEngineService.findBestRoute(routeRequest);

    // Transform to DTO format
    const bestRoute = this.transformToProviderQuoteDto(routeResponse.bestRoute);
    const alternatives = routeResponse.alternatives.map(alt => 
      this.transformToProviderQuoteDto(alt)
    );

    // Calculate fee breakdown
    const feeBreakdown = this.calculateFeeBreakdown(routeResponse.bestRoute);

    // Store quote in database for analytics and get the quote ID
    const quoteId = await this.storeQuote(routeResponse.bestRoute, routeResponse.requestId);

    return {
      bestRoute,
      alternatives,
      requestId: routeResponse.requestId,
      quoteId,
      totalResponseTime: Date.now() - startTime,
      cacheHitRatio: routeResponse.cacheHitRatio,
      feeBreakdown,
    };
  }
}
