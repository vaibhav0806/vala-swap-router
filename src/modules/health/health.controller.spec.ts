import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { createTestingModule, validateApiResponse, validateTimestamp } from '../../test/utils/test-helpers';
import { createMockHealthService } from '../../test/mocks/service-mocks';
import { createMockHealthStatus } from '../../test/fixtures';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthService>;

  beforeEach(async () => {
    healthService = createMockHealthService();

    const module: TestingModule = await createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: healthService },
      ],
      overrideGuards: false, // Health endpoints typically don't use throttling
    });

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /healthz', () => {
    describe('Success Cases', () => {
      it('should return healthy status', async () => {
        const mockHealth = { status: 'ok', timestamp: '2024-01-01T00:00:00.000Z' };
        healthService.getSimpleHealth.mockResolvedValue(mockHealth);

        const result = await controller.healthCheck();

        expect(result).toEqual(mockHealth);
        expect(result.status).toBe('ok');
        validateApiResponse(result, ['status', 'timestamp']);
      });

      it('should return error status when unhealthy', async () => {
        const unhealthyStatus = { status: 'error', timestamp: '2024-01-01T00:00:00.000Z' };
        healthService.getSimpleHealth.mockResolvedValue(unhealthyStatus);

        const result = await controller.healthCheck();

        expect(result.status).toBe('error');
      });
    });
  });

  describe('GET /healthz/detailed', () => {
    describe('Success Cases', () => {
      it('should return detailed health information', async () => {
        const mockDetailedHealth = createMockHealthStatus();
        healthService.getHealthStatus.mockResolvedValue(mockDetailedHealth);

        const result = await controller.detailedHealthCheck();

        expect(result).toEqual(mockDetailedHealth);
        validateApiResponse(result, ['status', 'timestamp', 'uptime', 'version', 'services', 'performance']);
        expect(result.services).toHaveProperty('database');
        expect(result.services).toHaveProperty('cache');
        expect(result.services).toHaveProperty('jupiter');
        expect(result.services).toHaveProperty('okx');
      });

      it('should handle degraded service status', async () => {
        const degradedHealth = createMockHealthStatus({
          status: 'error',
          services: {
            database: { status: 'unhealthy', responseTime: 5000, lastCheck: '2024-01-01T00:00:00.000Z' },
            cache: { status: 'healthy', responseTime: 5, lastCheck: '2024-01-01T00:00:00.000Z' },
            jupiter: { status: 'healthy', responseTime: 150, lastCheck: '2024-01-01T00:00:00.000Z' },
            okx: { status: 'healthy', responseTime: 120, lastCheck: '2024-01-01T00:00:00.000Z' }
          }
        });
        healthService.getHealthStatus.mockResolvedValue(degradedHealth);

        const result = await controller.detailedHealthCheck();

        expect(result.status).toBe('degraded');
        expect(result.services.database.status).toBe('unhealthy');
      });
    });
  });

  describe('GET /healthz/live', () => {
    it('should always return alive status', () => {
      const result = controller.live();

      expect(result.status).toBe('alive');
      expect(result.timestamp).toBeDefined();
      validateTimestamp(result.timestamp);
    });

    it('should return fresh timestamp on each call', () => {
      const result1 = controller.live();
      const result2 = controller.live();

      expect(result1.timestamp).not.toBe(result2.timestamp);
      expect(new Date(result2.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(result1.timestamp).getTime());
    });
  });

  describe('GET /healthz/ready', () => {
    describe('Success Cases', () => {
      it('should return ready when application is healthy', async () => {
        const mockHealth = { status: 'ok', timestamp: '2024-01-01T00:00:00.000Z' };
        healthService.getSimpleHealth.mockResolvedValue(mockHealth);

        const result = await controller.ready();

        expect(result).toEqual({
          status: 'ready',
          timestamp: mockHealth.timestamp
        });
      });
    });

    describe('Error Cases', () => {
      it('should throw error when application is not ready', async () => {
        const unhealthyStatus = { status: 'error', timestamp: '2024-01-01T00:00:00.000Z' };
        healthService.getSimpleHealth.mockResolvedValue(unhealthyStatus);

        await expect(controller.ready()).rejects.toThrow('Application not ready');
      });
    });
  });
});
