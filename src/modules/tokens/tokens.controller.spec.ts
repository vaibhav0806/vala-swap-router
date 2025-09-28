import { Test, TestingModule } from '@nestjs/testing';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { SwapException } from '../../common/exceptions/swap.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { GetTokensQueryDto } from './dto/token.dto';
import { createTestingModule, expectSwapException, validateApiResponse } from '../../test/utils/test-helpers';
import { createMockTokensService } from '../../test/mocks/service-mocks';
import { createMockToken, createMockUsdcToken, createMockTokensResponse, TEST_ADDRESSES } from '../../test/fixtures';

describe('TokensController', () => {
  let controller: TokensController;
  let tokensService: jest.Mocked<TokensService>;

  beforeEach(async () => {
    tokensService = createMockTokensService();

    const module: TestingModule = await createTestingModule({
      controllers: [TokensController],
      providers: [
        { provide: TokensService, useValue: tokensService },
      ],
    });

    controller = module.get<TokensController>(TokensController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /tokens', () => {
    const validQuery: GetTokensQueryDto = {
      search: 'SOL',
      chainId: 1,
      isActive: true,
      limit: 50,
      offset: 0
    };

    describe('Success Cases', () => {
      it('should return tokens successfully', async () => {
        const mockResponse = createMockTokensResponse();
        tokensService.getTokens.mockResolvedValue(mockResponse);

        const result = await controller.getTokens(validQuery);

        expect(result).toEqual(mockResponse);
        expect(tokensService.getTokens).toHaveBeenCalledWith(validQuery);
        validateApiResponse(result, ['tokens', 'total', 'limit', 'offset', 'hasMore']);
      });

      it('should handle empty query parameters', async () => {
        const emptyQuery = {};
        const mockResponse = createMockTokensResponse();
        tokensService.getTokens.mockResolvedValue(mockResponse);

        await controller.getTokens(emptyQuery as GetTokensQueryDto);

        expect(tokensService.getTokens).toHaveBeenCalledWith(emptyQuery);
      });

      it('should handle pagination', async () => {
        const paginationQuery = { limit: 10, offset: 20 };
        const paginatedResponse = createMockTokensResponse({ limit: 10, offset: 20 });
        tokensService.getTokens.mockResolvedValue(paginatedResponse);

        const result = await controller.getTokens(paginationQuery as GetTokensQueryDto);

        expect(result.limit).toBe(10);
        expect(result.offset).toBe(20);
      });
    });

    describe('Error Cases', () => {
      it('should handle database errors', async () => {
        tokensService.getTokens.mockRejectedValue(
          new SwapException(ErrorCode.DATABASE_ERROR, {})
        );

        await expectSwapException(
          () => controller.getTokens(validQuery),
          ErrorCode.DATABASE_ERROR
        );
      });
    });
  });

  describe('GET /tokens/popular', () => {
    describe('Success Cases', () => {
      it('should return popular tokens with correct parameters', async () => {
        const mockResponse = createMockTokensResponse({ limit: 20 });
        tokensService.getTokens.mockResolvedValue(mockResponse);

        const result = await controller.getPopularTokens();

        expect(result).toEqual(mockResponse);
        expect(tokensService.getTokens).toHaveBeenCalledWith({
          limit: 20,
          offset: 0,
          isActive: true,
        });
      });
    });
  });

  describe('GET /tokens/search/:query', () => {
    describe('Success Cases', () => {
      it('should search tokens by query', async () => {
        const searchQuery = 'SOL';
        const mockResponse = createMockTokensResponse();
        tokensService.getTokens.mockResolvedValue(mockResponse);

        const result = await controller.searchTokens(searchQuery);

        expect(result).toEqual(mockResponse);
        expect(tokensService.getTokens).toHaveBeenCalledWith({
          search: searchQuery,
          limit: 50,
          offset: 0,
          isActive: true,
        });
      });

      it('should handle empty search results', async () => {
        const emptyResponse = createMockTokensResponse({ tokens: [], total: 0, hasMore: false });
        tokensService.getTokens.mockResolvedValue(emptyResponse);

        const result = await controller.searchTokens('NONEXISTENT');

        expect(result.tokens.length).toBe(0);
        expect(result.total).toBe(0);
      });

      it('should handle special characters in search', async () => {
        const specialQuery = 'USD-C@!';
        const mockResponse = createMockTokensResponse();
        tokensService.getTokens.mockResolvedValue(mockResponse);

        await controller.searchTokens(specialQuery);

        expect(tokensService.getTokens).toHaveBeenCalledWith(
          expect.objectContaining({ search: specialQuery })
        );
      });
    });
  });

  describe('POST /tokens/seed', () => {
    describe('Success Cases', () => {
      it('should seed default tokens successfully', async () => {
        tokensService.seedDefaultTokens.mockResolvedValue(undefined);

        const result = await controller.seedDefaultTokens();

        expect(result).toEqual({ message: 'Default tokens seeded successfully' });
        expect(tokensService.seedDefaultTokens).toHaveBeenCalledTimes(1);
      });
    });

    describe('Error Cases', () => {
      it('should handle seeding errors', async () => {
        tokensService.seedDefaultTokens.mockRejectedValue(
          new SwapException(ErrorCode.DATABASE_ERROR, { operation: 'seed' })
        );

        await expectSwapException(
          () => controller.seedDefaultTokens(),
          ErrorCode.DATABASE_ERROR
        );
      });
    });
  });

  describe('GET /tokens/:address', () => {
    describe('Success Cases', () => {
      it('should return token by address successfully', async () => {
        const mockToken = createMockToken();
        tokensService.getTokenByAddress.mockResolvedValue(mockToken);

        const result = await controller.getTokenByAddress(TEST_ADDRESSES.SOL);

        expect(result).toEqual(mockToken);
        expect(tokensService.getTokenByAddress).toHaveBeenCalledWith(TEST_ADDRESSES.SOL);
        validateApiResponse(result, ['address', 'symbol', 'name', 'decimals', 'chainId']);
      });

      it('should handle different token types', async () => {
        const usdcToken = createMockUsdcToken();
        tokensService.getTokenByAddress.mockResolvedValue(usdcToken);

        const result = await controller.getTokenByAddress(TEST_ADDRESSES.USDC);

        expect(result.symbol).toBe('USDC');
        expect(result.address).toBe(TEST_ADDRESSES.USDC);
      });
    });

    describe('Error Cases', () => {
      it('should throw SwapException when token not found', async () => {
        tokensService.getTokenByAddress.mockResolvedValue(null);

        await expectSwapException(
          () => controller.getTokenByAddress(TEST_ADDRESSES.NON_EXISTENT),
          ErrorCode.TOKEN_NOT_FOUND
        );
      });

      it('should handle invalid address format', async () => {
        tokensService.getTokenByAddress.mockResolvedValue(null);

        await expectSwapException(
          () => controller.getTokenByAddress(TEST_ADDRESSES.INVALID),
          ErrorCode.TOKEN_NOT_FOUND
        );
      });
    });
  });
});
