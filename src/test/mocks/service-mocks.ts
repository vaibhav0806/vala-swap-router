import { SwapService } from '../../modules/swap/swap.service';
import { QuoteService } from '../../modules/quote/quote.service';
import { TokensService } from '../../modules/tokens/tokens.service';
import { HealthService } from '../../modules/health/health.service';
import { MetricsService } from '../../modules/metrics/metrics.service';
import { AppService } from '../../app.service';

export const createMockSwapService = (): jest.Mocked<SwapService> => ({
  executeSwap: jest.fn(),
  simulateSwap: jest.fn(),
  getSwapStatus: jest.fn(),
  updateSwapStatus: jest.fn(),
} as any);

export const createMockQuoteService = (): jest.Mocked<QuoteService> => ({
  getQuote: jest.fn(),
  getQuoteById: jest.fn(),
  validateAmount: jest.fn(),
} as any);

export const createMockTokensService = (): jest.Mocked<TokensService> => ({
  getTokens: jest.fn(),
  getTokenByAddress: jest.fn(),
  seedDefaultTokens: jest.fn(),
  validateTokenPair: jest.fn(),
} as any);

export const createMockHealthService = (): jest.Mocked<HealthService> => ({
  getSimpleHealth: jest.fn(),
  getHealthStatus: jest.fn(),
} as any);

export const createMockMetricsService = (): jest.Mocked<MetricsService> => ({
  getMetricsSummary: jest.fn(),
  calculateCacheHitRatio: jest.fn(),
  recordRequestMetrics: jest.fn(),
  recordCacheHit: jest.fn(),
  recordCacheMiss: jest.fn(),
  recordQuoteRequest: jest.fn(),
  recordSwapRequest: jest.fn(),
  recordProviderLatency: jest.fn(),
  setProviderAvailability: jest.fn(),
  recordRouteScore: jest.fn(),
  incrementActiveConnections: jest.fn(),
  decrementActiveConnections: jest.fn(),
  setDatabaseConnections: jest.fn(),
} as any);

export const createMockAppService = (): jest.Mocked<AppService> => ({
  getHello: jest.fn(),
} as any);
