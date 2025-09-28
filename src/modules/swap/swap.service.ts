import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwapTransaction, SwapStatus, SwapProvider } from '../../database/entities/swap-transaction.entity';
import { Quote, QuoteProvider } from '../../database/entities/quote.entity';
import { JupiterAdapter } from '../adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from '../adapters/okx/okx.adapter';
import { QuoteService } from '../quote/quote.service';
import { CacheService } from '../cache/cache.service';
import { 
  ExecuteSwapDto, 
  SimulateSwapDto, 
  SwapExecutionResponseDto, 
  SwapSimulationResponseDto, 
  SwapStatusDto 
} from './dto/swap.dto';
import { 
  BuildTransactionRequest, 
  SimulateTransactionRequest 
} from '../../common/interfaces/dex-adapter.interface';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  constructor(
    @InjectRepository(SwapTransaction)
    private swapRepository: Repository<SwapTransaction>,
    @InjectRepository(Quote)
    private quoteRepository: Repository<Quote>,
    private jupiterAdapter: JupiterAdapter,
    private okxAdapter: OkxAdapter,
    private quoteService: QuoteService,
    private cacheService: CacheService,
    private metricsService: MetricsService, // Add metrics service
  ) {}

  async executeSwap(request: ExecuteSwapDto): Promise<SwapExecutionResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing swap', { 
        quoteId: request.quoteId,
        userPublicKey: request.userPublicKey 
      });

      // Get and validate quote
      const quote = await this.validateAndGetQuote(request.quoteId);

      // Check if quote is still valid
      if (new Date() > quote.expiresAt) {
        throw new SwapException(ErrorCode.ROUTE_EXPIRED, {
          quoteId: request.quoteId,
          expiresAt: quote.expiresAt,
        });
      }

      // Create swap transaction record
      const swapTransaction = await this.createSwapTransaction(quote, request);

      // Track swap initiation
      this.metricsService.trackSwap(
        quote.provider === QuoteProvider.JUPITER ? 'jupiter' : 'okx',
        'initiated',
        quote.inputToken,
        quote.outputToken
      );

      // Get the appropriate adapter
      const adapter = this.getAdapterForProvider(quote.provider);

      // Build the transaction - FIX THIS SECTION
      const buildRequest: BuildTransactionRequest = {
        quoteResponse: {
          inputMint: quote.inputToken,
          outputMint: quote.outputToken,
          inAmount: quote.inputAmount,
          outAmount: quote.outputAmount,
          otherAmountThreshold: quote.outputAmount,
          swapMode: 'ExactIn' as const,
          slippageBps: 50, // Default slippage
          platformFee: null,
          priceImpactPct: quote.priceImpactPct || '0',
          routePlan: quote.routePlan,
          timeTaken: quote.responseTimeMs,
          contextSlot: undefined,
        },
        userPublicKey: request.userPublicKey,
        wrapAndUnwrapSol: request.wrapAndUnwrapSol,
        useSharedAccounts: request.useSharedAccounts,
        feeAccount: request.feeAccount,
        computeUnitPriceMicroLamports: request.computeUnitPriceMicroLamports,
        asLegacyTransaction: request.asLegacyTransaction,
      };

      const transactionResult = await adapter.buildTransaction(buildRequest);

      // Update swap transaction with built transaction
      swapTransaction.routeData = {
        ...swapTransaction.routeData,
        transaction: transactionResult,
        buildRequest,
      };
      await this.swapRepository.save(swapTransaction);

      const processingTime = Date.now() - startTime;

      const response: SwapExecutionResponseDto = {
        transactionId: swapTransaction.id,
        status: swapTransaction.status,
        transaction: {
          swapTransaction: transactionResult.swapTransaction,
          lastValidBlockHeight: transactionResult.lastValidBlockHeight,
          prioritizationFeeLamports: transactionResult.prioritizationFeeLamports,
        },
        processingTime,
        expiresAt: swapTransaction.expiresAt,
      };

      // Track successful swap preparation
      this.metricsService.trackSwap(
        quote.provider === QuoteProvider.JUPITER ? 'jupiter' : 'okx',
        'prepared',
        quote.inputToken,
        quote.outputToken
      );

      this.logger.debug('Swap execution prepared', {
        transactionId: swapTransaction.id,
        provider: quote.provider,
        processingTime,
      });

      return response;
    } catch (error) {
      this.logger.error('Swap execution failed:', error);
      
      if (error instanceof SwapException) {
        throw error;
      }

      throw new SwapException(ErrorCode.TRANSACTION_FAILED, {
        quoteId: request.quoteId,
        error: error.message,
        processingTime: Date.now() - startTime,
      });
    }
  }

  async simulateSwap(request: SimulateSwapDto): Promise<SwapSimulationResponseDto> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Simulating swap', { 
        quoteId: request.quoteId,
        userPublicKey: request.userPublicKey 
      });

      // Get and validate quote
      const quote = await this.validateAndGetQuote(request.quoteId);

      // Check if quote is still valid
      if (new Date() > quote.expiresAt) {
        throw new SwapException(ErrorCode.ROUTE_EXPIRED, {
          quoteId: request.quoteId,
          expiresAt: quote.expiresAt,
        });
      }

      // Get the appropriate adapter
      const adapter = this.getAdapterForProvider(quote.provider);

      // Build transaction for simulation
      const buildRequest: BuildTransactionRequest = {
        quoteResponse: quote.routePlan, // This would be the full quote response
        userPublicKey: request.userPublicKey,
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        asLegacyTransaction: false,
      };

      const transactionResult = await adapter.buildTransaction(buildRequest);

      // Simulate the transaction
      const simulateRequest: SimulateTransactionRequest = {
        transaction: transactionResult.swapTransaction,
        userPublicKey: request.userPublicKey,
      };

      const simulationResult = await adapter.simulateTransaction(simulateRequest);

      // Create a temporary transaction record for tracking (optional)
      const tempTransaction = this.swapRepository.create({
        userAddress: request.userPublicKey,
        inputToken: quote.inputToken,
        outputToken: quote.outputToken,
        inputAmount: quote.inputAmount,
        outputAmount: quote.outputAmount,
        minOutputAmount: quote.outputAmount, // For simulation, use same amount
        slippageBps: 50, // Default
        provider: quote.provider === QuoteProvider.JUPITER ? SwapProvider.JUPITER : SwapProvider.OKX,
        status: SwapStatus.PENDING,
        routeData: { simulation: true, quote, transaction: transactionResult },
        expiresAt: new Date(Date.now() + 30000),
      });

      const savedTransaction = await this.swapRepository.save(tempTransaction);

      const processingTime = Date.now() - startTime;

      const response: SwapSimulationResponseDto = {
        transactionId: savedTransaction.id,
        transaction: {
          swapTransaction: transactionResult.swapTransaction,
          lastValidBlockHeight: transactionResult.lastValidBlockHeight,
          prioritizationFeeLamports: transactionResult.prioritizationFeeLamports,
        },
        simulation: {
          success: simulationResult.success,
          error: simulationResult.error,
          computeUnitsConsumed: simulationResult.computeUnitsConsumed,
          logs: simulationResult.logs,
        },
        processingTime,
      };

      this.logger.debug('Swap simulation completed', {
        transactionId: savedTransaction.id,
        success: simulationResult.success,
        processingTime,
      });

      return response;
    } catch (error) {
      this.logger.error('Swap simulation failed:', error);
      
      if (error instanceof SwapException) {
        throw error;
      }

      throw new SwapException(ErrorCode.TRANSACTION_FAILED, {
        quoteId: request.quoteId,
        operation: 'simulate',
        error: error.message,
        processingTime: Date.now() - startTime,
      });
    }
  }

  async getSwapStatus(transactionId: string): Promise<SwapStatusDto> {
    try {
      const swap = await this.swapRepository.findOne({
        where: { id: transactionId },
      });

      if (!swap) {
        throw new SwapException(ErrorCode.ROUTE_NOT_FOUND, {
          transactionId,
        });
      }

      return {
        id: swap.id,
        status: swap.status,
        userAddress: swap.userAddress,
        inputToken: swap.inputToken,
        outputToken: swap.outputToken,
        inputAmount: swap.inputAmount,
        outputAmount: swap.outputAmount,
        provider: swap.provider,
        transactionHash: swap.transactionHash,
        createdAt: swap.createdAt,
        updatedAt: swap.updatedAt,
        expiresAt: swap.expiresAt,
        executionTimeMs: swap.executionTimeMs,
        errorCode: swap.errorCode,
        errorMessage: swap.errorMessage,
      };
    } catch (error) {
      this.logger.error(`Failed to get swap status for ${transactionId}:`, error);
      
      if (error instanceof SwapException) {
        throw error;
      }

      throw new SwapException(ErrorCode.DATABASE_ERROR, {
        operation: 'getSwapStatus',
        transactionId,
        error: error.message,
      });
    }
  }

  async updateSwapStatus(
    transactionId: string, 
    status: SwapStatus, 
    transactionHash?: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: Partial<SwapTransaction> = {
        status,
        updatedAt: new Date(),
      };

      if (transactionHash) {
        updateData.transactionHash = transactionHash;
      }

      if (status === SwapStatus.COMPLETED || status === SwapStatus.FAILED) {
        updateData.executionTimeMs = Date.now() - new Date(await this.getSwapCreationTime(transactionId)).getTime();
      }

      if (errorCode) {
        updateData.errorCode = errorCode;
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await this.swapRepository.update({ id: transactionId }, updateData);

      // Track status change metrics
      const swap = await this.swapRepository.findOne({ where: { id: transactionId } });
      if (swap) {
        this.metricsService.trackSwap(
          swap.provider,
          status,
          swap.inputToken,
          swap.outputToken
        );
      }

      this.logger.debug(`Updated swap status: ${transactionId} -> ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update swap status for ${transactionId}:`, error);
      throw new SwapException(ErrorCode.DATABASE_ERROR, {
        operation: 'updateSwapStatus',
        transactionId,
        error: error.message,
      });
    }
  }

  private async validateAndGetQuote(quoteId: string): Promise<Quote> {
    const quote = await this.quoteService.getQuoteById(quoteId);
    
    if (!quote) {
      throw new SwapException(ErrorCode.ROUTE_NOT_FOUND, {
        quoteId,
      });
    }

    return quote;
  }

  private getAdapterForProvider(provider: string) {
    switch (provider.toLowerCase()) {
      case 'jupiter':
        return this.jupiterAdapter;
      case 'okx':
        return this.okxAdapter;
      default:
        throw new SwapException(ErrorCode.DEX_UNAVAILABLE, {
          provider,
          reason: 'Unsupported provider',
        });
    }
  }

  private async createSwapTransaction(quote: Quote, request: ExecuteSwapDto): Promise<SwapTransaction> {
    const swapTransaction = this.swapRepository.create({
      userAddress: request.userPublicKey,
      inputToken: quote.inputToken,
      outputToken: quote.outputToken,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount,
      minOutputAmount: quote.outputAmount, // Could calculate based on slippage
      slippageBps: 50, // Default or from quote
      provider: quote.provider === QuoteProvider.JUPITER ? SwapProvider.JUPITER : SwapProvider.OKX,
      status: SwapStatus.PENDING,
      routeData: {
        quoteId: quote.id,
        quote: quote.routePlan,
        requestParams: request,
      },
      feeAmount: quote.feeAmount,
      gasEstimate: quote.gasEstimate,
      expiresAt: new Date(Date.now() + 30000), // 30 seconds from now
    });

    return this.swapRepository.save(swapTransaction);
  }

  private async getSwapCreationTime(transactionId: string): Promise<Date> {
    const swap = await this.swapRepository.findOne({
      where: { id: transactionId },
      select: ['createdAt'],
    });
    
    return swap?.createdAt || new Date();
  }
}
