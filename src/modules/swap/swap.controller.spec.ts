import { Test, TestingModule } from '@nestjs/testing';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';
import { SwapException } from '../../common/exceptions/swap.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { ExecuteSwapDto, SimulateSwapDto } from './dto/swap.dto';
import { createTestingModule, expectSwapException, validateApiResponse } from '../../test/utils/test-helpers';
import { createMockSwapService } from '../../test/mocks/service-mocks';
import { 
  createMockSwapExecutionResponse, 
  createMockSwapSimulationResponse, 
  createMockSwapStatus,
  TEST_ADDRESSES,
  TEST_IDS 
} from '../../test/fixtures';

describe('SwapController', () => {
  let controller: SwapController;
  let swapService: jest.Mocked<SwapService>;

  beforeEach(async () => {
    swapService = createMockSwapService();

    const module: TestingModule = await createTestingModule({
      controllers: [SwapController],
      providers: [
        { provide: SwapService, useValue: swapService },
      ],
    });

    controller = module.get<SwapController>(SwapController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /swap/execute', () => {
    const validExecuteSwapDto: ExecuteSwapDto = {
      quoteId: TEST_IDS.QUOTE,
      userPublicKey: TEST_ADDRESSES.USER_WALLET,
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
      computeUnitPriceMicroLamports: 1000,
      asLegacyTransaction: false
    };

    describe('Success Cases', () => {
      it('should execute swap successfully', async () => {
        const mockResponse = createMockSwapExecutionResponse();
        swapService.executeSwap.mockResolvedValue(mockResponse);

        const result = await controller.executeSwap(validExecuteSwapDto);

        expect(result).toEqual(mockResponse);
        expect(swapService.executeSwap).toHaveBeenCalledWith(validExecuteSwapDto);
        validateApiResponse(result, ['transactionId', 'status', 'transaction', 'processingTime', 'expiresAt']);
      });

      it('should handle optional parameters correctly', async () => {
        const minimalDto = {
          quoteId: TEST_IDS.QUOTE,
          userPublicKey: TEST_ADDRESSES.USER_WALLET,
        };
        const mockResponse = createMockSwapExecutionResponse();
        swapService.executeSwap.mockResolvedValue(mockResponse);

        await controller.executeSwap(minimalDto as ExecuteSwapDto);

        expect(swapService.executeSwap).toHaveBeenCalledWith(minimalDto);
      });
    });

    describe('Error Cases', () => {
      it('should handle route not found', async () => {
        swapService.executeSwap.mockRejectedValue(
          new SwapException(ErrorCode.ROUTE_NOT_FOUND, { quoteId: validExecuteSwapDto.quoteId })
        );

        await expectSwapException(
          () => controller.executeSwap(validExecuteSwapDto),
          ErrorCode.ROUTE_NOT_FOUND
        );
      });

      it('should handle route expired', async () => {
        swapService.executeSwap.mockRejectedValue(
          new SwapException(ErrorCode.ROUTE_EXPIRED, { quoteId: validExecuteSwapDto.quoteId })
        );

        await expectSwapException(
          () => controller.executeSwap(validExecuteSwapDto),
          ErrorCode.ROUTE_EXPIRED
        );
      });

      it('should handle DEX unavailable', async () => {
        swapService.executeSwap.mockRejectedValue(
          new SwapException(ErrorCode.DEX_UNAVAILABLE, { provider: 'jupiter' })
        );

        await expectSwapException(
          () => controller.executeSwap(validExecuteSwapDto),
          ErrorCode.DEX_UNAVAILABLE
        );
      });
    });
  });

  describe('POST /swap/simulate', () => {
    const validSimulateSwapDto: SimulateSwapDto = {
      quoteId: TEST_IDS.QUOTE,
      userPublicKey: TEST_ADDRESSES.USER_WALLET
    };

    describe('Success Cases', () => {
      it('should simulate swap successfully', async () => {
        const mockResponse = createMockSwapSimulationResponse();
        swapService.simulateSwap.mockResolvedValue(mockResponse);

        const result = await controller.simulateSwap(validSimulateSwapDto);

        expect(result).toEqual(mockResponse);
        expect(swapService.simulateSwap).toHaveBeenCalledWith(validSimulateSwapDto);
        validateApiResponse(result, ['transactionId', 'transaction', 'simulation', 'processingTime']);
      });

      it('should handle failed simulation', async () => {
        const failedSimulation = createMockSwapSimulationResponse({
          simulation: {
            success: false,
            error: 'Insufficient balance',
            computeUnitsConsumed: 0,
            logs: ['Error: Insufficient balance']
          }
        });
        swapService.simulateSwap.mockResolvedValue(failedSimulation);

        const result = await controller.simulateSwap(validSimulateSwapDto);

        expect(result.simulation.success).toBe(false);
        expect(result.simulation.error).toBe('Insufficient balance');
      });
    });

    describe('Error Cases', () => {
      it('should handle route expired during simulation', async () => {
        swapService.simulateSwap.mockRejectedValue(
          new SwapException(ErrorCode.ROUTE_EXPIRED, { quoteId: validSimulateSwapDto.quoteId })
        );

        await expectSwapException(
          () => controller.simulateSwap(validSimulateSwapDto),
          ErrorCode.ROUTE_EXPIRED
        );
      });
    });
  });

  describe('GET /swap/:transactionId', () => {
    describe('Success Cases', () => {
      it('should return swap status successfully', async () => {
        const mockStatus = createMockSwapStatus();
        swapService.getSwapStatus.mockResolvedValue(mockStatus);

        const result = await controller.getSwapStatus(TEST_IDS.TRANSACTION);

        expect(result).toEqual(mockStatus);
        expect(swapService.getSwapStatus).toHaveBeenCalledWith(TEST_IDS.TRANSACTION);
        validateApiResponse(result, ['id', 'status', 'userAddress', 'inputToken', 'outputToken']);
      });

      it('should handle different swap statuses', async () => {
        const statuses = ['pending', 'completed', 'failed', 'expired'];
        
        for (const status of statuses) {
          const mockStatus = createMockSwapStatus({ status });
          swapService.getSwapStatus.mockResolvedValue(mockStatus);

          const result = await controller.getSwapStatus(TEST_IDS.TRANSACTION);
          expect(result.status).toBe(status);
        }
      });
    });

    describe('Error Cases', () => {
      it('should handle transaction not found', async () => {
        swapService.getSwapStatus.mockRejectedValue(
          new SwapException(ErrorCode.ROUTE_NOT_FOUND, { transactionId: 'non-existent' })
        );

        await expectSwapException(
          () => controller.getSwapStatus('non-existent'),
          ErrorCode.ROUTE_NOT_FOUND
        );
      });
    });
  });

  describe('GET /swap', () => {
    it('should return swap statistics', async () => {
      const result = await controller.getSwapStatistics();

      validateApiResponse(result, ['totalSwaps', 'successRate', 'averageExecutionTime', 'totalVolumeUsd', 'topProviders']);
      expect(typeof result.totalSwaps).toBe('number');
      expect(typeof result.successRate).toBe('number');
      expect(typeof result.averageExecutionTime).toBe('number');
      expect(typeof result.totalVolumeUsd).toBe('string');
      expect(Array.isArray(result.topProviders)).toBe(true);
    });
  });

  describe('POST /swap/:transactionId/cancel', () => {
    describe('Success Cases', () => {
      it('should cancel pending swap successfully', async () => {
        const pendingStatus = createMockSwapStatus({ status: 'pending' });
        swapService.getSwapStatus.mockResolvedValue(pendingStatus);
        swapService.updateSwapStatus.mockResolvedValue(undefined);

        const result = await controller.cancelSwap(TEST_IDS.TRANSACTION);

        expect(result).toEqual({
          transactionId: TEST_IDS.TRANSACTION,
          status: 'cancelled',
          message: 'Swap transaction cancelled successfully',
        });
        validateApiResponse(result, ['transactionId', 'status', 'message']);
      });
    });

    describe('Error Cases', () => {
      it('should not allow cancelling completed transactions', async () => {
        const completedStatus = createMockSwapStatus({ status: 'completed' });
        swapService.getSwapStatus.mockResolvedValue(completedStatus);

        await expectSwapException(
          () => controller.cancelSwap(TEST_IDS.TRANSACTION),
          ErrorCode.INVALID_INPUT
        );
        expect(swapService.updateSwapStatus).not.toHaveBeenCalled();
      });

      it('should not allow cancelling failed transactions', async () => {
        const failedStatus = createMockSwapStatus({ status: 'failed' });
        swapService.getSwapStatus.mockResolvedValue(failedStatus);

        await expectSwapException(
          () => controller.cancelSwap(TEST_IDS.TRANSACTION),
          ErrorCode.INVALID_INPUT
        );
      });
    });
  });
});
