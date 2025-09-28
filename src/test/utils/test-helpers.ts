import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Creates a mock NestJS testing module with common overrides
 */
export const createTestingModule = async (metadata: {
  controllers: any[];
  providers: any[];
  imports?: any[];
  overrideGuards?: boolean;
}) => {
  const moduleBuilder = Test.createTestingModule({
    controllers: metadata.controllers,
    providers: metadata.providers,
    imports: metadata.imports || [],
  });

  // Override ThrottlerGuard by default for controller tests
  if (metadata.overrideGuards !== false) {
    moduleBuilder.overrideGuard(ThrottlerGuard).useValue({
      canActivate: jest.fn(() => true),
    });
  }

  return moduleBuilder.compile();
};

/**
 * Creates a mock Express Response object
 */
export const createMockResponse = (): jest.Mocked<Response> => ({
  set: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
} as any);

/**
 * Assert that a function throws a specific SwapException
 */
export const expectSwapException = async (
  fn: () => Promise<any>,
  expectedErrorCode: string,
  expectedMessage?: string
) => {
  try {
    await fn();
    fail('Expected function to throw SwapException');
  } catch (error) {
    expect(error.name).toBe('SwapException');
    expect(error.getResponse().errorCode).toBe(expectedErrorCode);
    if (expectedMessage) {
      expect(error.getResponse().message).toBe(expectedMessage);
    }
  }
};

/**
 * Validates common response structure
 */
export const validateApiResponse = (response: any, expectedKeys: string[]) => {
  expectedKeys.forEach(key => {
    expect(response).toHaveProperty(key);
  });
};

/**
 * Creates a date in ISO string format for consistent testing
 */
export const createTestDate = (offset: number = 0): string => {
  const baseDate = new Date('2024-01-01T00:00:00.000Z');
  baseDate.setMilliseconds(baseDate.getMilliseconds() + offset);
  return baseDate.toISOString();
};

/**
 * Validates that timestamps are recent and properly formatted
 */
export const validateTimestamp = (timestamp: string, tolerance: number = 5000) => {
  const timestampDate = new Date(timestamp);
  const now = new Date();
  expect(timestampDate).toBeInstanceOf(Date);
  expect(timestampDate.getTime()).toBeLessThanOrEqual(now.getTime() + tolerance);
  expect(timestampDate.getTime()).toBeGreaterThanOrEqual(now.getTime() - tolerance);
};
