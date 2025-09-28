import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetQuoteDto {
  @ApiProperty({ 
    description: 'Input token mint address',
    example: 'So11111111111111111111111111111111111111112'
  })
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { 
    message: 'Input mint must be a valid Solana address' 
  })
  inputMint: string;

  @ApiProperty({ 
    description: 'Output token mint address',
    example: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  })
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { 
    message: 'Output mint must be a valid Solana address' 
  })
  outputMint: string;

  @ApiProperty({ 
    description: 'Input amount in smallest token units',
    example: '1000000000'
  })
  @IsString()
  @Matches(/^\d+$/, { 
    message: 'Amount must be a positive integer string' 
  })
  amount: string;

  @ApiPropertyOptional({ 
    description: 'Slippage tolerance in basis points (1 bps = 0.01%)',
    example: 50,
    minimum: 1,
    maximum: 10000,
    default: 50
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  @Transform(({ value }) => parseInt(value))
  slippageBps?: number = 50;

  @ApiPropertyOptional({ 
    description: 'User wallet public key for account optimization',
    example: '8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ'
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { 
    message: 'User public key must be a valid Solana address' 
  })
  userPublicKey?: string;

  @ApiPropertyOptional({ 
    description: 'Favor low latency routes over maximum output',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  favorLowLatency?: boolean = false;

  @ApiPropertyOptional({ 
    description: 'Maximum number of alternative routes to return',
    example: 3,
    minimum: 0,
    maximum: 10,
    default: 3
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  @Transform(({ value }) => parseInt(value))
  maxRoutes?: number = 3;
}

export class RouteStepDto {
  @ApiProperty({ example: 'Jupiter Exchange' })
  ammKey: string;

  @ApiPropertyOptional({ example: 'Orca' })
  label?: string;

  @ApiProperty({ example: 'So11111111111111111111111111111111111111112' })
  inputMint: string;

  @ApiProperty({ example: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' })
  outputMint: string;

  @ApiProperty({ example: '1000000000' })
  inAmount: string;

  @ApiProperty({ example: '145670000' })
  outAmount: string;

  @ApiProperty({ example: '1000000' })
  feeAmount: string;

  @ApiProperty({ example: 'So11111111111111111111111111111111111111112' })
  feeMint: string;
}

export class RouteScoreDto {
  @ApiProperty({ 
    description: 'Normalized output amount score (0-1)',
    example: 0.85 
  })
  outputAmount: number;

  @ApiProperty({ 
    description: 'Normalized fees score (0-1, lower is better)',
    example: 0.15 
  })
  fees: number;

  @ApiProperty({ 
    description: 'Normalized gas estimate score (0-1, lower is better)',
    example: 0.25 
  })
  gasEstimate: number;

  @ApiProperty({ 
    description: 'Normalized latency score (0-1, lower is better)',
    example: 0.12 
  })
  latency: number;

  @ApiProperty({ 
    description: 'Provider reliability score (0-1)',
    example: 0.95 
  })
  reliability: number;

  @ApiProperty({ 
    description: 'Total weighted score',
    example: 0.78 
  })
  totalScore: number;
}

export class ProviderQuoteDto {
  @ApiProperty({ example: 'So11111111111111111111111111111111111111112' })
  inputMint: string;

  @ApiProperty({ example: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' })
  outputMint: string;

  @ApiProperty({ example: '1000000000' })
  inAmount: string;

  @ApiProperty({ example: '145670000' })
  outAmount: string;

  @ApiProperty({ example: '143750000' })
  otherAmountThreshold: string;

  @ApiProperty({ example: 'ExactIn' })
  swapMode: string;

  @ApiProperty({ example: 50 })
  slippageBps: number;

  @ApiPropertyOptional({
    type: 'object',
    properties: {
      amount: { type: 'string', example: '1000000' },
      feeBps: { type: 'number', example: 100 }
    }
  })
  platformFee?: {
    amount: string;
    feeBps: number;
  };

  @ApiProperty({ example: '0.5' })
  priceImpactPct: string;

  @ApiProperty({ type: [RouteStepDto] })
  routePlan: RouteStepDto[];

  @ApiProperty({ example: 1250 })
  timeTaken: number;

  @ApiPropertyOptional({ example: 195847291 })
  contextSlot?: number;

  @ApiProperty({ example: 'Jupiter' })
  provider: string;

  @ApiProperty({ example: 1250 })
  responseTime: number;

  @ApiProperty({ type: RouteScoreDto })
  score: RouteScoreDto;

  @ApiProperty({ example: false })
  isCached: boolean;
}

export class QuoteResponseDto {
  @ApiProperty({ type: ProviderQuoteDto })
  bestRoute: ProviderQuoteDto;

  @ApiProperty({ type: [ProviderQuoteDto] })
  alternatives: ProviderQuoteDto[];

  @ApiProperty({ example: 'req_1704067200000_abc123def' })
  requestId: string;

  @ApiProperty({ 
    description: 'Database quote ID for swap execution',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  quoteId: string;

  @ApiProperty({ example: 2100 })
  totalResponseTime: number;

  @ApiProperty({ 
    description: 'Cache hit ratio (0.0 = all misses, 1.0 = all hits)',
    example: 0.0 
  })
  cacheHitRatio: number;

  @ApiProperty({ 
    description: 'Fee breakdown for the best route',
    type: 'object',
    properties: {
      platformFee: { type: 'string', example: '1000000' },
      gasFee: { type: 'string', example: '5000' },
      totalFee: { type: 'string', example: '1005000' },
      feePercentage: { type: 'string', example: '0.1005' }
    }
  })
  feeBreakdown: {
    platformFee: string;
    gasFee: string;
    totalFee: string;
    feePercentage: string;
  };
}
