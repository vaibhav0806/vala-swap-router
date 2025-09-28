import { QuoteResponse } from './dex-adapter.interface';

export interface RouteRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  userPublicKey?: string;
  favorLowLatency?: boolean;
  maxRoutes?: number;
}

export interface RouteScore {
  outputAmount: number;
  fees: number;
  gasEstimate: number;
  latency: number;
  reliability: number;
  totalScore: number;
}

export interface ProviderQuote extends QuoteResponse {
  provider: string;
  responseTime: number;
  score: RouteScore;
  isCached: boolean;
}

export interface BestRouteResponse {
  bestRoute: ProviderQuote;
  alternatives: ProviderQuote[];
  requestId: string;
  totalResponseTime: number;
  cacheHitRatio: number;
}

export interface RouteEngineConfig {
  performanceWeights: {
    outputAmount: number;
    fees: number;
    gasEstimate: number;
    latency: number;
    reliability: number;
  };
  routeExpirationMs: number;
  maxAlternatives: number;
  enableCaching: boolean;
}

export interface RouteEngine {
  findBestRoute(request: RouteRequest): Promise<BestRouteResponse>;
  calculateRouteScore(quote: QuoteResponse, responseTime: number): RouteScore;
  getConfig(): RouteEngineConfig;
}
