import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TokensService } from './tokens.service';
import { GetTokensQueryDto, TokensResponseDto, TokenResponseDto } from './dto/token.dto';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';

@ApiTags('tokens')
@Controller('tokens')
@UseGuards(ThrottlerGuard)
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get supported tokens',
    description: 'Retrieve a list of supported tokens with optional filtering and pagination'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of tokens',
    type: TokensResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid query parameters' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded' 
  })
  async getTokens(@Query() query: GetTokensQueryDto): Promise<TokensResponseDto> {
    return this.tokensService.getTokens(query);
  }

  @Get('popular')
  @ApiOperation({ 
    summary: 'Get popular tokens',
    description: 'Retrieve the most popular tokens based on trading volume'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of popular tokens',
    type: TokensResponseDto
  })
  async getPopularTokens(): Promise<TokensResponseDto> {
    const query: GetTokensQueryDto = {
      limit: 20,
      offset: 0,
      isActive: true,
    };

    return this.tokensService.getTokens(query);
  }

  @Get('search/:query')
  @ApiOperation({ 
    summary: 'Search tokens',
    description: 'Search for tokens by symbol or name'
  })
  @ApiParam({ 
    name: 'query', 
    description: 'Search query string',
    example: 'SOL'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Search results',
    type: TokensResponseDto
  })
  async searchTokens(@Param('query') searchQuery: string): Promise<TokensResponseDto> {
    const query: GetTokensQueryDto = {
      search: searchQuery,
      limit: 50,
      offset: 0,
      isActive: true,
    };

    return this.tokensService.getTokens(query);
  }

  @Post('seed')
  @ApiOperation({ 
    summary: 'Seed default tokens',
    description: 'Populate the database with default tokens (SOL, USDC, USDT)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Default tokens seeded successfully'
  })
  async seedDefaultTokens(): Promise<{ message: string }> {
    await this.tokensService.seedDefaultTokens();
    return { message: 'Default tokens seeded successfully' };
  }

  @Get(':address')
  @ApiOperation({ 
    summary: 'Get token by address',
    description: 'Retrieve detailed information about a specific token by its contract address'
  })
  @ApiParam({ 
    name: 'address', 
    description: 'Token contract address',
    example: 'So11111111111111111111111111111111111111112'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token details',
    type: TokenResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Token not found' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded' 
  })
  async getTokenByAddress(@Param('address') address: string): Promise<TokenResponseDto> {
    const token = await this.tokensService.getTokenByAddress(address);
    
    if (!token) {
      throw new SwapException(ErrorCode.TOKEN_NOT_FOUND, { address });
    }

    return token;
  }
}
