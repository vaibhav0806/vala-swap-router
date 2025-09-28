import { registerAs } from '@nestjs/config';

export default registerAs('dex', () => ({
  jupiter: {
    apiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
    timeout: 3000,
    retries: 2,
  },
  okx: {
    apiUrl: process.env.OKX_API_URL || 'https://web3.okx.com/api/v6/dex/aggregator',
    accessKey: process.env.OKX_API_KEY,
    secretKey: process.env.OKX_SECRET_KEY,
    passphrase: process.env.OKX_PASSPHRASE,
    timeout: 3000,
    retries: 2,
  },
  
  // Performance thresholds for route selection
  performanceWeights: {
    outputAmount: 0.4,    // 40% weight on output amount
    fees: 0.25,           // 25% weight on fees
    gasEstimate: 0.15,    // 15% weight on gas
    latency: 0.15,        // 15% weight on latency
    reliability: 0.05,    // 5% weight on reliability score
  },
  
  // Route expiration settings
  routeExpirationMs: 30000, // 30 seconds
  slippageToleranceBps: 50, // 0.5% default slippage
}));
