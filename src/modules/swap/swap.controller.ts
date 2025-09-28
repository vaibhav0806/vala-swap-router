import { Controller, Post, Get, Body, Param, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SwapService } from './swap.service';
import { 
  ExecuteSwapDto, 
  SimulateSwapDto, 
  SwapExecutionResponseDto, 
  SwapSimulationResponseDto, 
  SwapStatusDto 
} from './dto/swap.dto';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';

@ApiTags('swap')
@Controller('swap')
@UseGuards(ThrottlerGuard)
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post('execute')
  @ApiOperation({ 
    summary: 'Execute swap transaction',
    description: 'Build and prepare a swap transaction for execution on the blockchain'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Swap transaction prepared successfully',
    type: SwapExecutionResponseDto
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
    description: 'Quote not found',
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
    status: 409, 
    description: 'Route expired',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        errorCode: { type: 'string', example: 'ROUTE_EXPIRED' },
        message: { type: 'string', example: 'The route has expired and is no longer valid' },
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
  async executeSwap(@Body() request: ExecuteSwapDto): Promise<SwapExecutionResponseDto> {
    return this.swapService.executeSwap(request);
  }

  @Post('simulate')
  @ApiOperation({ 
    summary: 'Simulate swap transaction',
    description: 'Simulate a swap transaction without executing it to check for potential issues'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Swap simulation completed',
    type: SwapSimulationResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Quote not found' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Route expired' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded' 
  })
  async simulateSwap(@Body() request: SimulateSwapDto): Promise<SwapSimulationResponseDto> {
    return this.swapService.simulateSwap(request);
  }

  @Get(':transactionId')
  @ApiOperation({ 
    summary: 'Get swap status',
    description: 'Retrieve the current status of a swap transaction'
  })
  @ApiParam({ 
    name: 'transactionId', 
    description: 'Swap transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Swap status retrieved',
    type: SwapStatusDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Transaction not found' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded' 
  })
  async getSwapStatus(@Param('transactionId') transactionId: string): Promise<SwapStatusDto> {
    return this.swapService.getSwapStatus(transactionId);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get swap statistics',
    description: 'Get aggregated statistics about swap performance and volume'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Swap statistics',
    schema: {
      type: 'object',
      properties: {
        totalSwaps: { type: 'number', example: 1250 },
        successRate: { type: 'number', example: 0.985 },
        averageExecutionTime: { type: 'number', example: 1850 },
        totalVolumeUsd: { type: 'string', example: '12500000' },
        topProviders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              provider: { type: 'string', example: 'jupiter' },
              count: { type: 'number', example: 750 },
              successRate: { type: 'number', example: 0.99 }
            }
          }
        }
      }
    }
  })
  async getSwapStatistics() {
    // This would typically aggregate data from the database
    // For now, returning mock data
    return {
      totalSwaps: 1250,
      successRate: 0.985,
      averageExecutionTime: 1850,
      totalVolumeUsd: '12500000',
      topProviders: [
        { provider: 'jupiter', count: 750, successRate: 0.99 },
        { provider: 'okx', count: 500, successRate: 0.98 },
      ],
    };
  }

  @Post(':transactionId/cancel')
  @ApiOperation({ 
    summary: 'Cancel pending swap',
    description: 'Cancel a pending swap transaction before it expires'
  })
  @ApiParam({ 
    name: 'transactionId', 
    description: 'Swap transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Swap cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        transactionId: { type: 'string' },
        status: { type: 'string', example: 'cancelled' },
        message: { type: 'string', example: 'Swap transaction cancelled successfully' }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Transaction not found' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Cannot cancel completed transaction' 
  })
  async cancelSwap(@Param('transactionId') transactionId: string) {
    const currentStatus = await this.swapService.getSwapStatus(transactionId);
    
    if (currentStatus.status === 'completed' || currentStatus.status === 'failed') {
      throw new SwapException(ErrorCode.INVALID_INPUT, {
        transactionId,
        currentStatus: currentStatus.status,
        reason: 'Cannot cancel already processed transaction',
      });
    }

    await this.swapService.updateSwapStatus(
      transactionId, 
      'failed' as any, // Using 'failed' to represent cancelled
      undefined,
      'USER_CANCELLED',
      'Transaction cancelled by user'
    );

    return {
      transactionId,
      status: 'cancelled',
      message: 'Swap transaction cancelled successfully',
    };
  }
}
