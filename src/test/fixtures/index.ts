import { TokenResponseDto, TokensResponseDto } from '../../modules/tokens/dto/token.dto';
import { QuoteResponseDto, ProviderQuoteDto } from '../../modules/quote/dto/quote.dto';
import { SwapExecutionResponseDto, SwapSimulationResponseDto, SwapStatusDto } from '../../modules/swap/dto/swap.dto';
import { HealthStatus } from '../../modules/health/health.service';
import { Quote, QuoteProvider } from '../../database/entities/quote.entity';

// Token Fixtures
export const createMockToken = (overrides: Partial<TokenResponseDto> = {}): TokenResponseDto => ({
  address: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  chainId: 1,
  logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  tags: ['wrapped-solana', 'solana-ecosystem'],
  isActive: true,
  dailyVolume: '1000000000000',
  marketCap: '50000000000000',
  priceUsd: '145.67',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  ...overrides,
});

export const createMockUsdcToken = (): TokenResponseDto => 
  createMockToken({
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    tags: ['stablecoin'],
    dailyVolume: '2000000000000',
    marketCap: '30000000000',
    priceUsd: '1.00',
  });

export const createMockTokensResponse = (overrides: Partial<TokensResponseDto> = {}): TokensResponseDto => ({
  tokens: [createMockToken(), createMockUsdcToken()],
  total: 150,
  limit: 50,
  offset: 0,
  hasMore: true,
  ...overrides,
});

// Quote Entity Fixture (for database operations)
export const createMockQuoteEntity = (overrides: Partial<Quote> = {}): Quote => ({
  id: TEST_IDS.QUOTE,
  inputToken: TEST_ADDRESSES.SOL,
  outputToken: TEST_ADDRESSES.USDC,
  inputAmount: '1000000000',
  outputAmount: '145670000',
  priceImpactPct: '0.5',
  provider: QuoteProvider.JUPITER,
  routePlan: [{
    ammKey: 'Jupiter Exchange',
    label: 'Orca',
    inputMint: TEST_ADDRESSES.SOL,
    outputMint: TEST_ADDRESSES.USDC,
    inAmount: '1000000000',
    outAmount: '145670000',
    feeAmount: '1000000',
    feeMint: TEST_ADDRESSES.SOL
  }],
  feeAmount: '1000000',
  gasEstimate: '5000',
  responseTimeMs: 1250,
  isCached: false,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  expiresAt: new Date('2024-01-01T00:05:00.000Z'),
  efficiencyScore: '0.85',
  reliabilityScore: '0.95',
  ...overrides,
});

export const createMockProviderQuote = (overrides: Partial<ProviderQuoteDto> = {}): ProviderQuoteDto => ({
  inputMint: TEST_ADDRESSES.SOL,
  outputMint: TEST_ADDRESSES.USDC,
  inAmount: '1000000000',
  outAmount: '145670000',
  otherAmountThreshold: '143750000',
  swapMode: 'ExactIn',
  slippageBps: 50,
  priceImpactPct: '0.5',
  routePlan: [{
    ammKey: 'Jupiter Exchange',
    label: 'Orca',
    inputMint: TEST_ADDRESSES.SOL,
    outputMint: TEST_ADDRESSES.USDC,
    inAmount: '1000000000',
    outAmount: '145670000',
    feeAmount: '1000000',
    feeMint: TEST_ADDRESSES.SOL
  }],
  timeTaken: 1250,
  provider: 'Jupiter',
  responseTime: 1250,
  score: {
    outputAmount: 0.85,
    fees: 0.15,
    gasEstimate: 0.25,
    latency: 0.12,
    reliability: 0.95,
    totalScore: 0.78
  },
  isCached: false,
  ...overrides,
});

export const createMockQuoteResponse = (overrides: Partial<QuoteResponseDto> = {}): QuoteResponseDto => ({
  bestRoute: createMockProviderQuote(),
  alternatives: [],
  requestId: 'req_1704067200000_abc123def',
  quoteId: '550e8400-e29b-41d4-a716-446655440000',
  totalResponseTime: 2100,
  cacheHitRatio: 0.0,
  feeBreakdown: {
    platformFee: '1000000',
    gasFee: '5000',
    totalFee: '1005000',
    feePercentage: '0.1005'
  },
  ...overrides,
});

// Swap Fixtures
export const createMockSwapTransaction = () => ({
  swapTransaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDArc...',
  lastValidBlockHeight: '344535535',
  prioritizationFeeLamports: 5000
});

export const createMockSwapExecutionResponse = (overrides: Partial<SwapExecutionResponseDto> = {}): SwapExecutionResponseDto => ({
  transactionId: 'tx-550e8400-e29b-41d4-a716-446655440000',
  status: 'pending',
  transaction: createMockSwapTransaction(),
  processingTime: 850,
  expiresAt: new Date('2024-01-01T00:00:30.000Z'),
  ...overrides,
});

export const createMockSwapSimulationResponse = (overrides: Partial<SwapSimulationResponseDto> = {}): SwapSimulationResponseDto => ({
  transactionId: 'tx-550e8400-e29b-41d4-a716-446655440000',
  transaction: createMockSwapTransaction(),
  simulation: {
    success: true,
    computeUnitsConsumed: 100000,
    logs: ['Program log: Instruction: Initialize', 'Program log: Instruction: Swap']
  },
  processingTime: 650,
  ...overrides,
});

export const createMockSwapStatus = (overrides: Partial<SwapStatusDto> = {}): SwapStatusDto => ({
  id: 'tx-550e8400-e29b-41d4-a716-446655440000',
  status: 'completed',
  userAddress: '8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ',
  inputToken: 'So11111111111111111111111111111111111111112',
  outputToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  inputAmount: '1000000000',
  outputAmount: '145670000',
  provider: 'jupiter',
  transactionHash: 'B8nTh..."',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:15.000Z'),
  expiresAt: new Date('2024-01-01T00:00:30.000Z'),
  executionTimeMs: 1250,
  ...overrides,
});

// Health Fixtures
export const createMockHealthStatus = (overrides: Partial<HealthStatus> = {}): HealthStatus => ({
  status: 'ok',
  timestamp: '2024-01-01T00:00:00.000Z',
  uptime: 3600,
  version: '0.0.1',
  services: {
    database: {
      status: 'healthy',
      responseTime: 15,
      lastCheck: '2024-01-01T00:00:00.000Z'
    },
    cache: {
      status: 'healthy',
      responseTime: 5,
      lastCheck: '2024-01-01T00:00:00.000Z'
    },
    jupiter: {
      status: 'healthy',
      responseTime: 150,
      lastCheck: '2024-01-01T00:00:00.000Z'
    },
    okx: {
      status: 'healthy',
      responseTime: 120,
      lastCheck: '2024-01-01T00:00:00.000Z'
    }
  },
  performance: {
    memoryUsage: {
      rss: 52428800,
      heapTotal: 20971520,
      heapUsed: 15728640,
      external: 1441792,
      arrayBuffers: 524288
    },
    cpuUsage: {
      user: 1000000,
      system: 500000
    }
  },
  ...overrides,
});

// Common test addresses
export const TEST_ADDRESSES = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USER_WALLET: '8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ',
  INVALID: 'invalid-address',
  NON_EXISTENT: 'NonExistentTokenAddress123456789012345678901234567890',
};

// Common test IDs
export const TEST_IDS = {
  QUOTE: '550e8400-e29b-41d4-a716-446655440000',
  TRANSACTION: 'tx-550e8400-e29b-41d4-a716-446655440000',
  REQUEST: 'req_1704067200000_abc123def',
};
