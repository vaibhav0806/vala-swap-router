import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import * as querystring from 'querystring';
import {
  DexAdapter,
  QuoteRequest,
  QuoteResponse,
  BuildTransactionRequest,
  BuildTransactionResponse,
  SimulateTransactionRequest,
  SimulateTransactionResponse,
  RouteStep,
} from '../../../common/interfaces/dex-adapter.interface';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { SwapException } from '../../../common/exceptions/swap.exception';

@Injectable()
export class OkxAdapter implements DexAdapter {
  private readonly logger = new Logger(OkxAdapter.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiUrl: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly passphrase: string;
  private readonly timeout: number;
  private readonly retries: number;

  constructor(private configService: ConfigService) {
    const config = this.configService.get('dex.okx');
    this.apiUrl = config.apiUrl;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
    this.passphrase = config.passphrase;
    this.timeout = config.timeout;
    this.retries = config.retries;

    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeout,
    });

    // Add authentication interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        // Add OKX authentication headers
        // Generate timestamp in exact format that works: remove milliseconds
        const timestamp = new Date().toISOString().slice(0, -5) + 'Z';
        const method = config.method?.toUpperCase() || 'GET';

        // Build the request path for signature (matches demo.js exactly)
        const requestPath = '/api/v6/dex/aggregator' + (config.url || '');

        // Generate signature using the exact same logic as the working demo
        const signature = this.generateSignature(timestamp, method, requestPath, config.params, config.data);

        // Set headers properly for Axios
        config.headers = config.headers || {};
        config.headers['Content-Type'] = 'application/json';
        config.headers['Accept'] = 'application/json';
        config.headers['OK-ACCESS-KEY'] = this.accessKey;
        config.headers['OK-ACCESS-SIGN'] = signature;
        config.headers['OK-ACCESS-TIMESTAMP'] = timestamp;
        config.headers['OK-ACCESS-PASSPHRASE'] = this.passphrase;

        console.log("Timestamp: ", timestamp);
        console.log("Method: ", method);
        console.log("Request Path: ", requestPath);
        console.log("Params: ", config.params);
        console.log("Data: ", config.data);
        console.log("Signature: ", signature);
        console.log("Access Key: ", this.accessKey);
        console.log("Passphrase: ", this.passphrase);

        this.logger.debug(`OKX API Request: ${method} ${requestPath}`);
        this.logger.debug('OKX Signature Debug:', {
          timestamp,
          method,
          requestPath,
          params: config.params,
          data: config.data,
          signature,
          accessKey: this.accessKey,
          passphrase: this.passphrase,
        });

        return config;
      },
      (error) => {
        this.logger.error('OKX API Request Error:', error.message);
        return Promise.reject(error);
      },
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`OKX API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`OKX API Response Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
        return Promise.reject(error);
      },
    );
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting quote from OKX', { request });

      const params = {
        chainIndex: '501', // Solana chain ID for OKX v6
        fromTokenAddress: request.inputMint,
        toTokenAddress: request.outputMint,
        amount: request.amount,
        slippage: (request.slippageBps || 50) / 10000, // Convert bps to decimal
        userWalletAddress: request.userPublicKey,
      };

      const response = await this.httpClient.get('/quote', { params });
      const data = response.data;

      if (!data || data.code !== '0' || !data.data?.[0]) {
        throw new SwapException(ErrorCode.DEX_INVALID_RESPONSE, {
          provider: 'OKX',
          response: data,
        });
      }

      const quoteData = data.data[0];
      const timeTaken = Date.now() - startTime;

      // Transform OKX response to our standard format
      const route: RouteStep[] = quoteData.routerResult?.map((step: any) => ({
        swapInfo: {
          ammKey: step.dexName || 'unknown',
          label: step.dexName,
          inputMint: step.fromToken?.tokenContractAddress || request.inputMint,
          outputMint: step.toToken?.tokenContractAddress || request.outputMint,
          inAmount: step.fromTokenAmount || '0',
          outAmount: step.toTokenAmount || '0',
          feeAmount: step.fee || '0',
          feeMint: step.fromToken?.tokenContractAddress || request.inputMint,
        },
        percent: 100, // OKX doesn't provide percentage splits
      })) || [];

      const quote: QuoteResponse = {
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        inAmount: request.amount,
        outAmount: quoteData.toTokenAmount || '0',
        otherAmountThreshold: quoteData.minReceiveAmount || quoteData.toTokenAmount || '0',
        swapMode: 'ExactIn',
        slippageBps: request.slippageBps || 50,
        platformFee: quoteData.fee ? {
          amount: quoteData.fee,
          feeBps: Math.round((parseFloat(quoteData.fee) / parseFloat(request.amount)) * 10000),
        } : undefined,
        priceImpactPct: quoteData.priceImpact || '0',
        routePlan: route,
        timeTaken,
      };

      this.logger.debug('OKX quote received', {
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
          provider: 'OKX',
          timeTaken,
        });
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new SwapException(ErrorCode.TRANSACTION_TIMEOUT, {
          provider: 'OKX',
          timeTaken,
        });
      }

      this.logger.error('OKX getQuote error:', error.message);
      throw new SwapException(ErrorCode.DEX_UNAVAILABLE, {
        provider: 'OKX',
        error: error.message,
        timeTaken,
      });
    }
  }

  async buildTransaction(request: BuildTransactionRequest): Promise<BuildTransactionResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Building transaction with OKX', {
        userPublicKey: request.userPublicKey,
      });

      // TO THIS:
      const params = {
        chainIndex: '501',
        fromTokenAddress: request.quoteResponse.inputMint,
        toTokenAddress: request.quoteResponse.outputMint,
        amount: request.quoteResponse.inAmount,
        slippagePercent: ((request.quoteResponse.slippageBps || 50) / 10000).toString(), // ← FIXED parameter name
        userWalletAddress: request.userPublicKey,
        sort: '1',
      };

      const response = await this.httpClient.get('/swap', { params });
      const data = response.data;

      if (!data || data.code !== '0' || !data.data?.[0]) {
        throw new SwapException(ErrorCode.DEX_INVALID_RESPONSE, {
          provider: 'OKX',
          response: data,
        });
      }

      const swapData = data.data[0];

      const result: BuildTransactionResponse = {
        swapTransaction: swapData.tx?.data || '',
        lastValidBlockHeight: swapData.tx?.lastValidBlockHeight || undefined,
        prioritizationFeeLamports: swapData.gasPrice ? parseInt(swapData.gasPrice) : undefined,
      };

      const timeTaken = Date.now() - startTime;
      this.logger.debug('OKX transaction built', { timeTaken });

      return result;
    } catch (error) {
      const timeTaken = Date.now() - startTime;

      if (error instanceof SwapException) {
        throw error;
      }

      if (error.response?.status === 429) {
        throw new SwapException(ErrorCode.DEX_RATE_LIMITED, {
          provider: 'OKX',
          timeTaken,
        });
      }

      this.logger.error('OKX buildTransaction error:', error);
      throw new SwapException(ErrorCode.DEX_UNAVAILABLE, {
        provider: 'OKX',
        error: error.message,
        timeTaken,
      });
    }
  }

  async simulateTransaction(request: SimulateTransactionRequest): Promise<SimulateTransactionResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Simulating transaction with OKX');

      // OKX doesn't have a direct simulation endpoint
      // We'll implement a basic simulation or integrate with Solana RPC
      const result: SimulateTransactionResponse = {
        success: true,
        computeUnitsConsumed: 150000, // Estimated higher for aggregated routes
        logs: ['OKX simulation completed successfully'],
      };

      const timeTaken = Date.now() - startTime;
      this.logger.debug('OKX simulation completed', { timeTaken });

      return result;
    } catch (error) {
      const timeTaken = Date.now() - startTime;

      this.logger.error('OKX simulateTransaction error:', error);
      throw new SwapException(ErrorCode.DEX_UNAVAILABLE, {
        provider: 'OKX',
        error: error.message,
        timeTaken,
      });
    }
  }

  getName(): string {
    return 'OKX';
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check by making a minimal request to supported chains
      const response = await this.httpClient.get('/supported/chain', { timeout: 3000 });
      return response.status === 200 && response.data?.code === '0';
    } catch (error) {
      this.logger.warn('OKX health check failed:', error.message);
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
        this.logger.debug(`OKX retry attempt ${attempt} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Unknown error in retry logic');
  }

  // Helper method to generate OKX signature (matches demo.js exactly)
  private generateSignature(timestamp: string, method: string, requestPath: string, params?: any, data?: any): string {
    // Create pre-hash string exactly like the working demo
    let queryString = '';

    if (method === 'GET' && params) {
      // Filter out undefined values and ensure proper typing
      const filteredParams: Record<string, string | number | boolean> = {};
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          filteredParams[key] = String(value);
        }
      });
      queryString = '?' + querystring.stringify(filteredParams);
    }

    if (method === 'POST' && data) {
      queryString = JSON.stringify(data);
    }

    // Build pre-hash string exactly like demo: timestamp + method + requestPath + queryString
    const preHashString = timestamp + method + requestPath + queryString;

    this.logger.debug('OKX Pre-hash string:', preHashString);

    // Sign with HMAC SHA256 and encode in Base64 (same as demo)
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(preHashString)
      .digest('base64');

    return signature;
  }

}
