import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindManyOptions } from 'typeorm';
import { Token } from '../../database/entities/token.entity';
import { CacheService } from '../cache/cache.service';
import { GetTokensQueryDto, TokenResponseDto, TokensResponseDto } from './dto/token.dto';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);
  private readonly CACHE_TTL = 300000; // 5 minutes

  constructor(
    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
    private cacheService: CacheService,
  ) {}

  async getTokens(query: GetTokensQueryDto): Promise<TokensResponseDto> {
    try {
      // Generate cache key
      const cacheKey = `tokens:${JSON.stringify(query)}`;
      
      // Try to get from cache first
      const cached = await this.cacheService.get<TokensResponseDto>(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached tokens result');
        return cached;
      }

      // Build query conditions
      const where: any = {};
      
      if (query.chainId !== undefined) {
        where.chainId = query.chainId;
      }
      
      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
      }
      
      if (query.search) {
        where.symbol = Like(`%${query.search.toUpperCase()}%`);
      }

      const findOptions: FindManyOptions<Token> = {
        where,
        take: query.limit,
        skip: query.offset,
        order: {
          dailyVolume: 'DESC',
          symbol: 'ASC',
        },
      };

      // Execute query
      const [tokens, total] = await this.tokenRepository.findAndCount(findOptions);

      // Transform to response format
      const tokenDtos: TokenResponseDto[] = tokens.map(token => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        chainId: token.chainId,
        logoURI: token.logoURI,
        tags: token.tags ? JSON.parse(token.tags) : undefined,
        isActive: token.isActive,
        dailyVolume: token.dailyVolume,
        marketCap: token.marketCap,
        priceUsd: token.priceUsd,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      }));

      const result: TokensResponseDto = {
        tokens: tokenDtos,
        total,
        limit: query.limit || 50,
        offset: query.offset || 0,
        hasMore: (query.offset || 0) + (query.limit || 50) < total,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      this.logger.debug(`Found ${tokens.length} tokens`, { 
        total, 
        query: query.search,
        chainId: query.chainId 
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to get tokens:', error);
      throw new SwapException(ErrorCode.DATABASE_ERROR, {
        operation: 'getTokens',
        query,
        error: error.message,
      });
    }
  }

  async getTokenByAddress(address: string): Promise<TokenResponseDto | null> {
    try {
      // Try cache first
      const cacheKey = this.cacheService.generateTokenKey(address);
      const cached = await this.cacheService.get<TokenResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }

      const token = await this.tokenRepository.findOne({
        where: { address, isActive: true },
      });

      if (!token) {
        return null;
      }

      const tokenDto: TokenResponseDto = {
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        chainId: token.chainId,
        logoURI: token.logoURI,
        tags: token.tags ? JSON.parse(token.tags) : undefined,
        isActive: token.isActive,
        dailyVolume: token.dailyVolume,
        marketCap: token.marketCap,
        priceUsd: token.priceUsd,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, tokenDto, this.CACHE_TTL);

      return tokenDto;
    } catch (error) {
      this.logger.error(`Failed to get token by address ${address}:`, error);
      throw new SwapException(ErrorCode.DATABASE_ERROR, {
        operation: 'getTokenByAddress',
        address,
        error: error.message,
      });
    }
  }

  async validateTokenPair(inputMint: string, outputMint: string): Promise<{ input: TokenResponseDto; output: TokenResponseDto }> {
    const [inputToken, outputToken] = await Promise.all([
      this.getTokenByAddress(inputMint),
      this.getTokenByAddress(outputMint),
    ]);

    if (!inputToken) {
      throw new SwapException(ErrorCode.TOKEN_NOT_FOUND, {
        tokenAddress: inputMint,
        tokenType: 'input',
      });
    }

    if (!outputToken) {
      throw new SwapException(ErrorCode.TOKEN_NOT_FOUND, {
        tokenAddress: outputMint,
        tokenType: 'output',
      });
    }

    return {
      input: inputToken,
      output: outputToken,
    };
  }

  async updateTokenPrice(address: string, priceUsd: string): Promise<void> {
    try {
      await this.tokenRepository.update(
        { address },
        { priceUsd, updatedAt: new Date() }
      );

      // Invalidate cache
      const cacheKey = this.cacheService.generateTokenKey(address);
      await this.cacheService.del(cacheKey);

      this.logger.debug(`Updated price for token ${address}: $${priceUsd}`);
    } catch (error) {
      this.logger.error(`Failed to update token price for ${address}:`, error);
      throw new SwapException(ErrorCode.DATABASE_ERROR, {
        operation: 'updateTokenPrice',
        address,
        error: error.message,
      });
    }
  }

  async seedDefaultTokens(): Promise<void> {
    try {
      const defaultTokens = [
        {
          address: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          chainId: 1,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
          tags: JSON.stringify(['wrapped-solana', 'solana-ecosystem']),
          isActive: true,
        },
        {
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          chainId: 1,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
          tags: JSON.stringify(['stablecoin']),
          isActive: true,
        },
        {
          address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          chainId: 1,
          logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
          tags: JSON.stringify(['stablecoin']),
          isActive: true,
        },
      ];

      for (const tokenData of defaultTokens) {
        const existingToken = await this.tokenRepository.findOne({
          where: { address: tokenData.address },
        });

        if (!existingToken) {
          await this.tokenRepository.save(tokenData);
          this.logger.debug(`Seeded token: ${tokenData.symbol}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to seed default tokens:', error);
    }
  }
}
