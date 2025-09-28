import { Test, TestingModule } from '@nestjs/testing';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { SwapException } from '../../common/exceptions/swap.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { GetQuoteDto } from './dto/quote.dto';
import { createTestingModule, expectSwapException, validateApiResponse } from '../../test/utils/test-helpers';
import { createMockQuoteService } from '../../test/mocks/service-mocks';
import { createMockQuoteResponse, createMockQuoteEntity, TEST_ADDRESSES, TEST_IDS } from '../../test/fixtures';

describe('QuoteController', () => {
  let controller: QuoteController;
  let quoteService: jest.Mocked<QuoteService>;

  beforeEach(async () => {
    quoteService = createMockQuoteService();

    const module: TestingModule = await createTestingModule({
      controllers: [QuoteController],
      providers: [
        { provide: QuoteService, useValue: quoteService },
      ],
    });

    controller = module.get<QuoteController>(QuoteController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /quote', () => {
    const validQuoteDto: GetQuoteDto = {
      inputMint: TEST_ADDRESSES.SOL,
      outputMint: TEST_ADDRESSES.USDC,
      amount: '1000000000',
      slippageBps: 50,
      userPublicKey: TEST_ADDRESSES.USER_WALLET,
      favorLowLatency: false,
      maxRoutes: 3
    };

    describe('Success Cases', () => {
      it('should return quote successfully', async () => {
        const mockResponse = createMockQuoteResponse();
        quoteService.getQuote.mockResolvedValue(mockResponse);

        const result = await controller.getQuote(validQuoteDto);

        expect(result).toEqual(mockResponse);
        expect(quoteService.getQuote).toHaveBeenCalledWith(validQuoteDto);
        validateApiResponse(result, ['bestRoute', 'alternatives', 'requestId', 'quoteId', 'totalResponseTime']);
      });

      it('should handle minimal required parameters', async () => {
        const minimalDto: GetQuoteDto = {
          inputMint: TEST_ADDRESSES.SOL,
          outputMint: TEST_ADDRESSES.USDC,
          amount: '1000000000'
        };
        const mockResponse = createMockQuoteResponse();
        quoteService.getQuote.mockResolvedValue(mockResponse);

        await controller.getQuote(minimalDto);

        expect(quoteService.getQuote).toHaveBeenCalledWith(minimalDto);
      });
    });

    describe('Validation Cases', () => {
      it('should reject same input and output tokens', async () => {
        const invalidDto = {
          ...validQuoteDto,
          outputMint: validQuoteDto.inputMint
        };

        await expectSwapException(
          () => controller.getQuote(invalidDto),
          ErrorCode.INVALID_INPUT,
          'Input and output tokens cannot be the same'
        );
        expect(quoteService.getQuote).not.toHaveBeenCalled();
      });
    });

    describe('Error Cases', () => {
      it('should handle route not found', async () => {
        quoteService.getQuote.mockRejectedValue(
          new SwapException(ErrorCode.ROUTE_NOT_FOUND, { 
            inputMint: validQuoteDto.inputMint,
            outputMint: validQuoteDto.outputMint 
          })
        );

        await expectSwapException(
          () => controller.getQuote(validQuoteDto),
          ErrorCode.ROUTE_NOT_FOUND
        );
      });

      it('should handle insufficient liquidity', async () => {
        quoteService.getQuote.mockRejectedValue(
          new SwapException(ErrorCode.INSUFFICIENT_LIQUIDITY, { 
            inputMint: validQuoteDto.inputMint,
            outputMint: validQuoteDto.outputMint,
            amount: validQuoteDto.amount
          })
        );

        await expectSwapException(
          () => controller.getQuote(validQuoteDto),
          ErrorCode.INSUFFICIENT_LIQUIDITY
        );
      });
    });
  });

  describe('GET /quote/:id', () => {
    describe('Success Cases', () => {
      it('should return quote by ID successfully', async () => {
        const mockQuote = createMockQuoteEntity();
        quoteService.getQuoteById.mockResolvedValue(mockQuote);

        const result = await controller.getQuoteById(TEST_IDS.QUOTE);

        expect(result).toEqual(mockQuote);
        expect(quoteService.getQuoteById).toHaveBeenCalledWith(TEST_IDS.QUOTE);
        validateApiResponse(result, ['id', 'inputToken', 'outputToken', 'inputAmount', 'outputAmount']);
      });
    });

    describe('Error Cases', () => {
      it('should throw SwapException when quote not found', async () => {
        quoteService.getQuoteById.mockResolvedValue(null);

        await expectSwapException(
          () => controller.getQuoteById('non-existent-id'),
          ErrorCode.ROUTE_NOT_FOUND
        );
      });
    });
  });

  describe('GET /quote/simulate', () => {
    const validQuoteDto: GetQuoteDto = {
      inputMint: TEST_ADDRESSES.SOL,
      outputMint: TEST_ADDRESSES.USDC,
      amount: '1000000000'
    };

    describe('Success Cases', () => {
      it('should return quote with simulation results', async () => {
        const mockResponse = createMockQuoteResponse();
        quoteService.getQuote.mockResolvedValue(mockResponse);

        const result = await controller.simulateQuote(validQuoteDto);

        expect(result).toEqual({
          ...mockResponse,
          simulation: {
            success: true,
            computeUnitsConsumed: 100000,
            logs: ['Simulation completed successfully'],
          },
        });
        validateApiResponse(result, ['bestRoute', 'alternatives', 'simulation']);
        expect(result.simulation).toHaveProperty('success');
        expect(result.simulation).toHaveProperty('computeUnitsConsumed');
        expect(result.simulation).toHaveProperty('logs');
      });
    });

    describe('Error Cases', () => {
      it('should handle quote service failures', async () => {
        quoteService.getQuote.mockRejectedValue(
          new SwapException(ErrorCode.ROUTE_NOT_FOUND, { 
            inputMint: validQuoteDto.inputMint,
            outputMint: validQuoteDto.outputMint 
          })
        );

        await expectSwapException(
          () => controller.simulateQuote(validQuoteDto),
          ErrorCode.ROUTE_NOT_FOUND
        );
      });
    });
  });
});
