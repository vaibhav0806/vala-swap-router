import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ExecuteSwapDto {
  @ApiProperty({ 
    description: 'Quote ID from a previous quote request',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsString()
  quoteId: string;

  @ApiProperty({ 
    description: 'User wallet public key',
    example: '8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ'
  })
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { 
    message: 'User public key must be a valid Solana address' 
  })
  userPublicKey: string;

  @ApiPropertyOptional({ 
    description: 'Whether to wrap/unwrap SOL automatically',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  wrapAndUnwrapSol?: boolean = true;

  @ApiPropertyOptional({ 
    description: 'Use shared accounts for optimization',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  useSharedAccounts?: boolean = true;

  @ApiPropertyOptional({ 
    description: 'Fee account for platform fees',
    example: 'FeeAccount1111111111111111111111111111111111'
  })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { 
    message: 'Fee account must be a valid Solana address' 
  })
  feeAccount?: string;

  @ApiPropertyOptional({ 
    description: 'Compute unit price in micro lamports',
    example: 1000,
    minimum: 0,
    maximum: 1000000
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  computeUnitPriceMicroLamports?: number;

  @ApiPropertyOptional({ 
    description: 'Create legacy transaction format',
    example: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  asLegacyTransaction?: boolean = false;
}

export class SimulateSwapDto {
  @ApiProperty({ 
    description: 'Quote ID from a previous quote request',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsString()
  quoteId: string;

  @ApiProperty({ 
    description: 'User wallet public key',
    example: '8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ'
  })
  @IsString()
  @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, { 
    message: 'User public key must be a valid Solana address' 
  })
  userPublicKey: string;
}

export class SwapTransactionDto {
  @ApiProperty({ 
    description: 'Base58 encoded transaction',
    example: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDArc...'
  })
  swapTransaction: string;

  @ApiPropertyOptional({ 
    description: 'Last valid block height',
    example: '344535535'
  })
  lastValidBlockHeight?: string;

  @ApiPropertyOptional({ 
    description: 'Prioritization fee in lamports',
    example: 5000
  })
  prioritizationFeeLamports?: number;
}

export class SwapSimulationDto {
  @ApiProperty({ 
    description: 'Whether simulation was successful',
    example: true
  })
  success: boolean;

  @ApiPropertyOptional({ 
    description: 'Error message if simulation failed',
    example: 'Insufficient balance'
  })
  error?: string;

  @ApiPropertyOptional({ 
    description: 'Compute units consumed',
    example: 100000
  })
  computeUnitsConsumed?: number;

  @ApiPropertyOptional({ 
    description: 'Transaction logs',
    example: ['Program log: Instruction: Initialize', 'Program log: Instruction: Swap']
  })
  logs?: string[];
}

export class SwapExecutionResponseDto {
  @ApiProperty({ 
    description: 'Transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  transactionId: string;

  @ApiProperty({ 
    description: 'Swap status',
    example: 'pending',
    enum: ['pending', 'completed', 'failed', 'expired']
  })
  status: string;

  @ApiProperty({ type: SwapTransactionDto })
  transaction: SwapTransactionDto;

  @ApiProperty({ 
    description: 'Request processing time in milliseconds',
    example: 850
  })
  processingTime: number;

  @ApiProperty({ 
    description: 'Transaction expires at',
    example: '2024-01-01T00:00:30.000Z'
  })
  expiresAt: Date;

  @ApiPropertyOptional({ 
    description: 'Transaction hash when submitted to blockchain',
    example: 'B8nTh..."'
  })
  transactionHash?: string;
}

export class SwapSimulationResponseDto {
  @ApiProperty({ 
    description: 'Transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  transactionId: string;

  @ApiProperty({ type: SwapTransactionDto })
  transaction: SwapTransactionDto;

  @ApiProperty({ type: SwapSimulationDto })
  simulation: SwapSimulationDto;

  @ApiProperty({ 
    description: 'Request processing time in milliseconds',
    example: 650
  })
  processingTime: number;
}

export class SwapStatusDto {
  @ApiProperty({ 
    description: 'Transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({ 
    description: 'Current status',
    example: 'completed',
    enum: ['pending', 'completed', 'failed', 'expired']
  })
  status: string;

  @ApiProperty({ 
    description: 'User address',
    example: '8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ'
  })
  userAddress: string;

  @ApiProperty({ 
    description: 'Input token address',
    example: 'So11111111111111111111111111111111111111112'
  })
  inputToken: string;

  @ApiProperty({ 
    description: 'Output token address',
    example: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  })
  outputToken: string;

  @ApiProperty({ 
    description: 'Input amount',
    example: '1000000000'
  })
  inputAmount: string;

  @ApiProperty({ 
    description: 'Expected output amount',
    example: '145670000'
  })
  outputAmount: string;

  @ApiProperty({ 
    description: 'DEX provider used',
    example: 'jupiter'
  })
  provider: string;

  @ApiPropertyOptional({ 
    description: 'Blockchain transaction hash',
    example: 'B8nTh..."'
  })
  transactionHash?: string;

  @ApiProperty({ 
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z'
  })
  createdAt: Date;

  @ApiProperty({ 
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:15.000Z'
  })
  updatedAt: Date;

  @ApiProperty({ 
    description: 'Transaction expires at',
    example: '2024-01-01T00:00:30.000Z'
  })
  expiresAt: Date;

  @ApiPropertyOptional({ 
    description: 'Execution time in milliseconds',
    example: 1250
  })
  executionTimeMs?: number;

  @ApiPropertyOptional({ 
    description: 'Error code if failed',
    example: 'SLIPPAGE_EXCEEDED'
  })
  errorCode?: string;

  @ApiPropertyOptional({ 
    description: 'Error message if failed',
    example: 'Transaction would exceed maximum slippage tolerance'
  })
  errorMessage?: string;
}
