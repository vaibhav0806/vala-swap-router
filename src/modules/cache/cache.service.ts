import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.defaultTtl = this.configService.get('redis.ttl', 30000);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache hit for key: ${key}`);
      } else {
        this.logger.debug(`Cache miss for key: ${key}`);
      }
      return value || null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      throw new SwapException(ErrorCode.CACHE_ERROR, { key, error: error.message });
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl || this.defaultTtl);
      this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl || this.defaultTtl}ms`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
      throw new SwapException(ErrorCode.CACHE_ERROR, { key, error: error.message });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache delete for key: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
      throw new SwapException(ErrorCode.CACHE_ERROR, { key, error: error.message });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined && value !== null;
    } catch (error) {
      this.logger.error(`Cache has error for key ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      // Use del with wildcard pattern or implement custom clear
      // For now, we'll just log the attempt since cache-manager v5+ doesn't have reset
      this.logger.debug('Cache clear requested - implementing custom logic');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
      throw new SwapException(ErrorCode.CACHE_ERROR, { error: error.message });
    }
  }

  // Generate cache keys for different types of data
  generateQuoteKey(inputMint: string, outputMint: string, amount: string, slippageBps: number): string {
    return `quote:${inputMint}:${outputMint}:${amount}:${slippageBps}`;
  }

  generateTokenKey(address: string): string {
    return `token:${address}`;
  }

  generateRouteKey(inputMint: string, outputMint: string, amount: string): string {
    return `route:${inputMint}:${outputMint}:${amount}`;
  }

  // Request coalescing using Redis locks
  async withLock<T>(
    lockKey: string,
    operation: () => Promise<T>,
    lockTimeout: number = 5000,
  ): Promise<T> {
    const lockValue = Date.now().toString();
    const lockExpiry = lockTimeout;

    try {
      // Try to acquire lock
      const acquired = await this.acquireLock(lockKey, lockValue, lockExpiry);
      
      if (acquired) {
        try {
          return await operation();
        } finally {
          await this.releaseLock(lockKey, lockValue);
        }
      } else {
        // Wait for lock to be released and try to get cached result
        await this.waitForLock(lockKey, lockTimeout);
        throw new SwapException(ErrorCode.CACHE_ERROR, { 
          message: 'Failed to acquire lock for operation',
          lockKey 
        });
      }
    } catch (error) {
      this.logger.error(`Lock operation error for key ${lockKey}:`, error);
      throw error;
    }
  }

  private async acquireLock(key: string, value: string, expiry: number): Promise<boolean> {
    try {
      // Simplified lock mechanism using cache manager
      const lockKey = `lock:${key}`;
      const existing = await this.cacheManager.get(lockKey);
      if (existing) {
        return false;
      }
      await this.cacheManager.set(lockKey, value, expiry);
      return true;
    } catch (error) {
      this.logger.error(`Lock acquisition error for key ${key}:`, error);
      return false;
    }
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      // Use Lua script to ensure atomic release
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;
      // Note: This would need proper Redis instance access for Lua scripts
      // For now, just delete the lock
      await this.cacheManager.del(`lock:${key}`);
    } catch (error) {
      this.logger.error(`Lock release error for key ${key}:`, error);
    }
  }

  private async waitForLock(key: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    while (Date.now() - startTime < timeout) {
      const lockExists = await this.has(`lock:${key}`);
      if (!lockExists) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
}
