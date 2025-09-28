import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { register } from 'prom-client';
import { createTestingModule, validateApiResponse, createMockResponse } from '../../test/utils/test-helpers';
import { createMockMetricsService } from '../../test/mocks/service-mocks';

// Mock prom-client register
jest.mock('prom-client', () => ({
  register: {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    metrics: jest.fn(),
  },
}));

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: jest.Mocked<MetricsService>;

  const mockMetricsSummary = {
    totalRequests: 15420,
    averageResponseTime: 125.5,
    errorRate: 0.02,
    cacheHitRate: 0.85,
    uptime: 3600,
    memoryUsage: {
      heapUsed: 15728640,
      heapTotal: 20971520,
      external: 1441792
    },
    activeConnections: 12,
    providerStats: {
      jupiter: {
        requests: 8750,
        averageLatency: 150,
        errorRate: 0.01,
        availability: 0.999
      },
      okx: {
        requests: 6670,
        averageLatency: 180,
        errorRate: 0.03,
        availability: 0.995
      }
    }
  };

  beforeEach(async () => {
    metricsService = createMockMetricsService();

    const module: TestingModule = await createTestingModule({
      controllers: [MetricsController],
      providers: [
        { provide: MetricsService, useValue: metricsService },
      ],
      overrideGuards: false, // Metrics endpoints are internal
    });

    controller = module.get<MetricsController>(MetricsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /metrics/summary', () => {
    describe('Success Cases', () => {
      it('should return comprehensive metrics summary', async () => {
        metricsService.getMetricsSummary.mockResolvedValue(mockMetricsSummary);

        const result = await controller.getMetricsSummary();

        expect(result).toEqual(mockMetricsSummary);
        validateApiResponse(result, [
          'totalRequests', 'averageResponseTime', 'errorRate', 
          'cacheHitRate', 'uptime', 'memoryUsage', 'activeConnections', 'providerStats'
        ]);
        expect(typeof result.totalRequests).toBe('number');
        expect(typeof result.averageResponseTime).toBe('number');
      });

      it('should include provider statistics', async () => {
        metricsService.getMetricsSummary.mockResolvedValue(mockMetricsSummary);

        const result = await controller.getMetricsSummary();

        expect(result.providerStats.jupiter).toBeDefined();
        expect(result.providerStats.okx).toBeDefined();
        expect(result.providerStats.jupiter.availability).toBeGreaterThan(0.9);
      });
    });
  });

  describe('GET /metrics/cache-stats', () => {
    describe('Success Cases', () => {
      it('should return cache statistics for all cache types', async () => {
        metricsService.calculateCacheHitRatio
          .mockResolvedValueOnce(0.85) // route
          .mockResolvedValueOnce(0.72) // quote  
          .mockResolvedValueOnce(0.95); // token

        const result = await controller.getCacheStats();

        expect(result).toEqual({
          route: 0.85,
          quote: 0.72,
          token: 0.95
        });
        validateApiResponse(result, ['route', 'quote', 'token']);
      });

      it('should handle zero cache hit ratios', async () => {
        metricsService.calculateCacheHitRatio.mockResolvedValue(0);

        const result = await controller.getCacheStats();

        expect(result.route).toBe(0);
        expect(result.quote).toBe(0);
        expect(result.token).toBe(0);
      });
    });
  });

  describe('GET /metrics/prometheus', () => {
    const mockPrometheusMetrics = `# HELP vala_swap_requests_total Total number of HTTP requests
# TYPE vala_swap_requests_total counter
vala_swap_requests_total{method="GET",route="/quote",status_code="200"} 1250`;

    describe('Success Cases', () => {
      it('should return Prometheus metrics with correct headers', async () => {
        (register.metrics as jest.Mock).mockResolvedValue(mockPrometheusMetrics);
        const mockResponse = createMockResponse();

        await controller.getPrometheusMetrics(mockResponse);

        expect(mockResponse.set).toHaveBeenCalledWith('Content-Type', register.contentType);
        expect(mockResponse.send).toHaveBeenCalledWith(mockPrometheusMetrics);
      });

      it('should handle empty metrics', async () => {
        (register.metrics as jest.Mock).mockResolvedValue('');
        const mockResponse = createMockResponse();

        await controller.getPrometheusMetrics(mockResponse);

        expect(mockResponse.send).toHaveBeenCalledWith('');
      });
    });

    describe('Error Cases', () => {
      it('should handle metrics registry errors', async () => {
        const error = new Error('Metrics registry error');
        (register.metrics as jest.Mock).mockRejectedValue(error);
        const mockResponse = createMockResponse();

        await expect(controller.getPrometheusMetrics(mockResponse)).rejects.toThrow(error);
        expect(mockResponse.send).not.toHaveBeenCalled();
      });
    });
  });
});
