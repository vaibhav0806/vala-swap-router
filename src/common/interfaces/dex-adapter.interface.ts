export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  userPublicKey?: string;
}

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: RouteStep[];
  timeTaken: number;
  contextSlot?: number;
}

export interface RouteStep {
  swapInfo: {
    ammKey: string;
    label?: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface BuildTransactionRequest {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  computeUnitPriceMicroLamports?: number;
  asLegacyTransaction?: boolean;
}

export interface BuildTransactionResponse {
  swapTransaction: string;
  lastValidBlockHeight?: string;
  prioritizationFeeLamports?: number;
}

export interface SimulateTransactionRequest {
  transaction: string;
  userPublicKey: string;
}

export interface SimulateTransactionResponse {
  success: boolean;
  error?: string;
  computeUnitsConsumed?: number;
  logs?: string[];
}

export interface DexAdapter {
  getQuote(request: QuoteRequest): Promise<QuoteResponse>;
  buildTransaction(request: BuildTransactionRequest): Promise<BuildTransactionResponse>;
  simulateTransaction(request: SimulateTransactionRequest): Promise<SimulateTransactionResponse>;
  getName(): string;
  isHealthy(): Promise<boolean>;
}
