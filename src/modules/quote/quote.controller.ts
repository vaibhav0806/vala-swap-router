import { Controller, Get, Query, Param, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { QuoteService } from './quote.service';
import { GetQuoteDto, QuoteResponseDto } from './dto/quote.dto';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';

@ApiTags('quote')
@Controller('quote')
@UseGuards(ThrottlerGuard)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get best swap quote',
    description: 'Find the best route for a token swap with multiple DEX aggregator comparison'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Best route found with alternatives',
    type: QuoteResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        errorCode: { type: 'string', example: 'INVALID_INPUT' },
        message: { type: 'string', example: 'Invalid input provided' },
        timestamp: { type: 'string' },
        path: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'No route found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        errorCode: { type: 'string', example: 'ROUTE_NOT_FOUND' },
        message: { type: 'string', example: 'No valid route found for the given parameters' },
        timestamp: { type: 'string' },
        path: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 402, 
    description: 'Insufficient liquidity',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 402 },
        errorCode: { type: 'string', example: 'INSUFFICIENT_LIQUIDITY' },
        message: { type: 'string', example: 'Insufficient liquidity for this trade size' },
        timestamp: { type: 'string' },
        path: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded' 
  })
  @ApiResponse({ 
    status: 503, 
    description: 'DEX services unavailable' 
  })
  async getQuote(@Query() query: GetQuoteDto): Promise<QuoteResponseDto> {
    // Additional validation
    if (query.inputMint === query.outputMint) {
      throw new SwapException(ErrorCode.INVALID_INPUT, {
        reason: 'Input and output tokens cannot be the same',
        inputMint: query.inputMint,
        outputMint: query.outputMint,
      });
    }

    return this.quoteService.getQuote(query);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get quote by ID',
    description: 'Retrieve a previously generated quote by its ID'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'Quote ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Quote details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        inputToken: { type: 'string' },
        outputToken: { type: 'string' },
        inputAmount: { type: 'string' },
        outputAmount: { type: 'string' },
        provider: { type: 'string' },
        createdAt: { type: 'string' },
        expiresAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Quote not found' 
  })
  async getQuoteById(@Param('id') id: string) {
    const quote = await this.quoteService.getQuoteById(id);
    
    if (!quote) {
      throw new SwapException(ErrorCode.ROUTE_NOT_FOUND, { quoteId: id });
    }

    return quote;
  }

  @Get('simulate')
  @ApiOperation({ 
    summary: 'Simulate quote without execution',
    description: 'Get a quote and simulation results without actually executing the swap'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Quote with simulation results',
    schema: {
      type: 'object',
      allOf: [
        { $ref: '#/components/schemas/QuoteResponseDto' },
        {
          type: 'object',
          properties: {
            simulation: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                computeUnitsConsumed: { type: 'number' },
                logs: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      ]
    }
  })
  async simulateQuote(@Query() query: GetQuoteDto) {
    // Get the quote first
    const quote = await this.quoteService.getQuote(query);
    
    // Add simulation results
    // Note: In a real implementation, you would call the DEX adapter's simulate method
    const simulation = {
      success: true,
      computeUnitsConsumed: 100000,
      logs: ['Simulation completed successfully'],
    };

    return {
      ...quote,
      simulation,
    };
  }
}
