import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  DexAdapter,
  QuoteRequest,
  QuoteResponse,
  BuildTransactionRequest,
  BuildTransactionResponse,
  SimulateTransactionRequest,
  SimulateTransactionResponse,
} from '../../../common/interfaces/dex-adapter.interface';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { SwapException } from '../../../common/exceptions/swap.exception';

@Injectable()
export class JupiterAdapter implements DexAdapter {
  private readonly logger = new Logger(JupiterAdapter.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiUrl: string;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(private configService: ConfigService) {
    const config = this.configService.get('dex.jupiter');
    this.apiUrl = config.apiUrl;
    this.timeout = config.timeout;
    this.retries = config.retries;

    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Jupiter API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Jupiter API Request Error:', error);
        return Promise.reject(error);
      },
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Jupiter API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`Jupiter API Response Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
        return Promise.reject(error);
      },
    );
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Getting quote from Jupiter', { request });

      const params = {
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        amount: request.amount,
        slippageBps: request.slippageBps || 50,
        swapMode: 'ExactIn',
        // Note: restrictIntermediateTokens: false is not supported for free tier
        // onlyDirectRoutes: false is also not supported for free tier
      };

      const response = await this.httpClient.get('/quote', { params });
      const data = response.data;

      if (!data || !data.outAmount) {
        throw new SwapException(ErrorCode.DEX_INVALID_RESPONSE, {
          provider: 'Jupiter',
          response: data,
        });
      }

      const timeTaken = Date.now() - startTime;

      const quote: QuoteResponse = {
        inputMint: data.inputMint,
        outputMint: data.outputMint,
        inAmount: data.inAmount,
        outAmount: data.outAmount,
        otherAmountThreshold: data.otherAmountThreshold,
        swapMode: data.swapMode || 'ExactIn',
        slippageBps: data.slippageBps,
        platformFee: null, // Jupiter expects null, not undefined or object
        priceImpactPct: data.priceImpactPct || '0',
        routePlan: data.routePlan || [],
        timeTaken,
        contextSlot: data.contextSlot,
      };

      this.logger.debug('Jupiter quote received', { 
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        inAmount: quote.inAmount,
        outAmount: quote.outAmount,
        timeTaken,
      });

      return quote;
    } catch (error) {
      const timeTaken = Date.now() - startTime;
      
      if (error instanceof SwapException) {
        throw error;
      }

      if (error.response?.status === 429) {
        throw new SwapException(ErrorCode.DEX_RATE_LIMITED, {
          provider: 'Jupiter',
          timeTaken,
        });
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new SwapException(ErrorCode.TRANSACTION_TIMEOUT, {
          provider: 'Jupiter',
          timeTaken,
        });
      }

      this.logger.error('Jupiter getQuote error:', error);
      throw new SwapException(ErrorCode.DEX_UNAVAILABLE, {
        provider: 'Jupiter',
        error: error.message,
        timeTaken,
      });
    }
  }

  async buildTransaction(request: BuildTransactionRequest): Promise<BuildTransactionResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Building transaction with Jupiter', { 
        userPublicKey: request.userPublicKey,
      });

      // Correct Jupiter API payload structure
      const payload = {
        userPublicKey: request.userPublicKey,
        quoteResponse: request.quoteResponse,
        wrapAndUnwrapSol: request.wrapAndUnwrapSol ?? true,
        useSharedAccounts: request.useSharedAccounts ?? true,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        ...(request.computeUnitPriceMicroLamports && {
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: request.computeUnitPriceMicroLamports * 1000,
              priorityLevel: "medium"
            }
          }
        }),
        ...(request.feeAccount && { feeAccount: request.feeAccount })
      };

      // Use correct Jupiter swap endpoint
      const response = await axios.post('https://lite-api.jup.ag/swap/v1/swap', payload, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      const data = response.data;

      if (!data || !data.swapTransaction) {
        throw new SwapException(ErrorCode.DEX_INVALID_RESPONSE, {
          provider: 'Jupiter',
          response: data,
        });
      }

      const result: BuildTransactionResponse = {
        swapTransaction: data.swapTransaction,
        lastValidBlockHeight: data.lastValidBlockHeight,
        prioritizationFeeLamports: data.prioritizationFeeLamports,
      };

      const timeTaken = Date.now() - startTime;
      this.logger.debug('Jupiter transaction built', { timeTaken });

      return result;
    } catch (error) {
      const timeTaken = Date.now() - startTime;

      if (error instanceof SwapException) {
        throw error;
      }

      if (error.response?.status === 429) {
        throw new SwapException(ErrorCode.DEX_RATE_LIMITED, {
          provider: 'Jupiter',
          timeTaken,
        });
      }

      this.logger.error('Jupiter buildTransaction error:', error);
      throw new SwapException(ErrorCode.DEX_UNAVAILABLE, {
        provider: 'Jupiter',
        error: error.message,
        timeTaken,
      });
    }
  }

  async simulateTransaction(request: SimulateTransactionRequest): Promise<SimulateTransactionResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Simulating transaction with Jupiter');

      // Jupiter doesn't have a direct simulation endpoint
      // We'll use a mock implementation or integrate with Solana RPC
      // For now, return a basic response
      const result: SimulateTransactionResponse = {
        success: true,
        computeUnitsConsumed: 100000, // Estimated
        logs: ['Simulation completed successfully'],
      };

      const timeTaken = Date.now() - startTime;
      this.logger.debug('Jupiter simulation completed', { timeTaken });

      return result;
    } catch (error) {
      const timeTaken = Date.now() - startTime;

      this.logger.error('Jupiter simulateTransaction error:', error);
      throw new SwapException(ErrorCode.DEX_UNAVAILABLE, {
        provider: 'Jupiter',
        error: error.message,
        timeTaken,
      });
    }
  }

  getName(): string {
    return 'Jupiter';
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check by making a minimal request
      const response = await this.httpClient.get('/tokens', { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('Jupiter health check failed:', error.message);
      return false;
    }
  }

  // Helper method to retry requests
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.retries) {
          break;
        }
        
        // Don't retry on certain errors
        if ((error as any).response?.status === 400 || (error as any).response?.status === 404) {
          break;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        this.logger.debug(`Jupiter retry attempt ${attempt} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Unknown error in retry logic');
  }
}
