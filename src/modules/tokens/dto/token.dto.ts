import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetTokensQueryDto {
  @ApiPropertyOptional({ 
    description: 'Search query for token symbol or name',
    example: 'SOL'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ 
    description: 'Chain ID to filter tokens',
    example: 1,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  chainId?: number = 1;

  @ApiPropertyOptional({ 
    description: 'Only return active tokens',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean = true;

  @ApiPropertyOptional({ 
    description: 'Number of tokens to return',
    example: 50,
    minimum: 1,
    maximum: 1000,
    default: 50
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Transform(({ value }) => parseInt(value))
  limit?: number = 50;

  @ApiPropertyOptional({ 
    description: 'Number of tokens to skip',
    example: 0,
    minimum: 0,
    default: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  offset?: number = 0;
}

export class TokenResponseDto {
  @ApiProperty({ example: 'So11111111111111111111111111111111111111112' })
  address: string;

  @ApiProperty({ example: 'SOL' })
  symbol: string;

  @ApiProperty({ example: 'Solana' })
  name: string;

  @ApiProperty({ example: 9 })
  decimals: number;

  @ApiProperty({ example: 1 })
  chainId: number;

  @ApiPropertyOptional({ example: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' })
  logoURI?: string;

  @ApiPropertyOptional({ example: ['wrapped-solana', 'solana-ecosystem'] })
  tags?: string[];

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: '1000000000000' })
  dailyVolume?: string;

  @ApiPropertyOptional({ example: '50000000000000' })
  marketCap?: string;

  @ApiPropertyOptional({ example: '145.67' })
  priceUsd?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class TokensResponseDto {
  @ApiProperty({ type: [TokenResponseDto] })
  tokens: TokenResponseDto[];

  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
