import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmHealthIndicator, HealthCheckService } from '@nestjs/terminus';
import { HealthService } from './health.service';
import { JupiterAdapter } from '../adapters/jupiter/jupiter.adapter';
import { OkxAdapter } from '../adapters/okx/okx.adapter';
import { CacheService } from '../cache/cache.service';

describe('HealthService', () => {
  let service: HealthService;
  let mockHealthCheckService: jest.Mocked<HealthCheckService>;
  let mockDbHealth: jest.Mocked<TypeOrmHealthIndicator>;
  let mockJupiterAdapter: jest.Mocked<JupiterAdapter>;
  let mockOkxAdapter: jest.Mocked<OkxAdapter>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    mockHealthCheckService = {
      check: jest.fn(),
    } as any;

    mockDbHealth = {
      pingCheck: jest.fn(),
    } as any;

    mockJupiterAdapter = {
      isHealthy: jest.fn(),
    } as any;

    mockOkxAdapter = {
      isHealthy: jest.fn(),
    } as any;

    mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockDbHealth },
        { provide: JupiterAdapter, useValue: mockJupiterAdapter },
        { provide: OkxAdapter, useValue: mockOkxAdapter },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSimpleHealth', () => {
    it('should return ok status when all services are healthy', async () => {
      // Mock all services as healthy
      mockHealthCheckService.check.mockResolvedValue({ database: { status: 'up' } });
      mockJupiterAdapter.isHealthy.mockResolvedValue(true);
      mockOkxAdapter.isHealthy.mockResolvedValue(true);
      mockCacheService.set.mockResolvedValue();
      mockCacheService.get.mockResolvedValue('test');
      mockCacheService.del.mockResolvedValue();

      const result = await service.getSimpleHealth();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });

    it('should return error status when services fail', async () => {
      // Mock services as failing
      mockHealthCheckService.check.mockRejectedValue(new Error('Database down'));

      const result = await service.getSimpleHealth();

      expect(result.status).toBe('error');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('getHealthStatus', () => {
    it('should return detailed health information', async () => {
      // Mock all services as healthy
      mockHealthCheckService.check.mockResolvedValue({ database: { status: 'up' } });
      mockJupiterAdapter.isHealthy.mockResolvedValue(true);
      mockOkxAdapter.isHealthy.mockResolvedValue(true);
      mockCacheService.set.mockResolvedValue();
      mockCacheService.get.mockResolvedValue('test');
      mockCacheService.del.mockResolvedValue();

      const result = await service.getHealthStatus();

      expect(result.status).toBe('ok');
      expect(result.services).toBeDefined();
      expect(result.services.database).toBeDefined();
      expect(result.services.cache).toBeDefined();
      expect(result.services.jupiter).toBeDefined();
      expect(result.services.okx).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
    });
  });
});
