import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { SwapException } from '../../common/exceptions/swap.exception';
import { MetricsService } from '../metrics/metrics.service';
import { register } from 'prom-client';
import { Histogram } from 'prom-client';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  
  // Request coalescing: Map of pending promises keyed by request signature
  private readonly pendingRequests = new Map<string, Promise<any>>();
  private readonly requestMetrics = new Map<string, { count: number; startTime: number }>();

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    // Clear existing metrics to prevent duplicates
    register.clear();
    
    // Then initialize all your existing metrics normally...
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    const cacheType = this.extractCacheType(key);
    
    try {
      const value = await this.cacheManager.get<T>(key);
      const duration = Date.now() - startTime;
      
      if (value) {
        this.logger.debug(`Cache hit for key: ${key}`);
        this.metricsService.trackCacheHit(cacheType, 'get');
      } else {
        this.logger.debug(`Cache miss for key: ${key}`);
        this.metricsService.trackCacheMiss(cacheType, 'get');
      }
      
      this.metricsService.trackCacheOperation('get', 'success', duration);
      return value || null;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.trackCacheOperation('get', 'error', duration);
      this.metricsService.trackCacheMiss(cacheType, 'get');
      
      this.logger.error(`Cache get error for key ${key}:`, error);
      throw new SwapException(ErrorCode.CACHE_ERROR, { key, error: error.message });
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    const cacheType = this.extractCacheType(key);
    
    try {
      await this.cacheManager.set(key, value, ttl || this.defaultTtl);
      const duration = Date.now() - startTime;
      
      this.metricsService.trackCacheOperation('set', 'success', duration);
      this.logger.debug(`Cache set for key: ${key}, TTL: ${ttl || this.defaultTtl}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.trackCacheOperation('set', 'error', duration);
      
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

  /**
   * Request coalescing wrapper - prevents duplicate requests for the same operation
   */
  async getWithCoalescing<T>(
    key: string, 
    factory: () => Promise<T>, 
    coalescingTimeout: number = 10000,
    ttl?: number
  ): Promise<T> {
    const startTime = Date.now();
    const cacheType = this.extractCacheType(key);
    
    // First, try to get from cache
    const cached = await this.get<T>(key);
    if (cached) {
      this.logger.debug(`Cache hit for coalesced request: ${key}`);
      return cached;
    }

    // Check if there's already a pending request for this key
    if (this.pendingRequests.has(key)) {
      this.logger.debug(`Coalescing request for key: ${key}`);
      
      // Track coalesced request metrics
      this.trackCoalescedRequest(key);
      this.metricsService.trackCacheOperation('coalesce', 'success', Date.now() - startTime);
      
      try {
        // Wait for the existing request to complete
        const result = await this.pendingRequests.get(key);
        
        // Try to get the result from cache (the original request should have cached it)
        const cachedResult = await this.get<T>(key);
        if (cachedResult) {
          return cachedResult;
        }
        
        // If not in cache, return the result directly
        return result;
      } catch (error) {
        this.logger.warn(`Coalesced request failed for key ${key}, falling back to new request:`, error);
        // If the coalesced request failed, make a new request
        return this.executeWithCoalescing(key, factory, coalescingTimeout, ttl);
      }
    }

    // No pending request, execute the factory function with coalescing
    return this.executeWithCoalescing(key, factory, coalescingTimeout, ttl);
  }

  private async executeWithCoalescing<T>(
    key: string,
    factory: () => Promise<T>,
    coalescingTimeout: number = 10000,
    ttl?: number
  ): Promise<T> {
    const startTime = Date.now();
    
    // Create the promise and store it for coalescing
    const promise = this.createCoalescedPromise(key, factory, coalescingTimeout, ttl);
    this.pendingRequests.set(key, promise);
    
    // Track the original request
    this.trackCoalescedRequest(key, true);
    
    try {
      const result = await promise;
      this.metricsService.trackCacheOperation('coalesce', 'success', Date.now() - startTime);
      return result;
    } catch (error) {
      this.metricsService.trackCacheOperation('coalesce', 'error', Date.now() - startTime);
      throw error;
    } finally {
      // Clean up the pending request
      this.pendingRequests.delete(key);
      this.finalizeRequestMetrics(key);
    }
  }

  private async createCoalescedPromise<T>(
    key: string,
    factory: () => Promise<T>,
    coalescingTimeout: number,
    ttl?: number
  ): Promise<T> {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new SwapException(ErrorCode.EXTERNAL_SERVICE_ERROR, {
          message: 'Request coalescing timeout',
          key,
          timeout: coalescingTimeout
        }));
      }, coalescingTimeout);
    });

    try {
      // Race between the factory function and timeout
      const result = await Promise.race([factory(), timeoutPromise]);
      
      // Cache the result for future requests
      if (result !== null && result !== undefined) {
        await this.set(key, result, ttl);
        this.logger.debug(`Cached coalesced result for key: ${key}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Coalesced request failed for key ${key}:`, error);
      throw error;
    }
  }

  private trackCoalescedRequest(key: string, isOriginal: boolean = false): void {
    const existing = this.requestMetrics.get(key);
    
    if (existing) {
      existing.count += 1;
    } else {
      this.requestMetrics.set(key, {
        count: 1,
        startTime: Date.now()
      });
    }

    // Track metrics
    if (isOriginal) {
      this.metricsService.incrementCounter('vala_swap_coalescing_original_requests_total', { cache_type: this.extractCacheType(key) });
    } else {
      this.metricsService.incrementCounter('vala_swap_coalescing_duplicate_requests_total', { cache_type: this.extractCacheType(key) });
    }
  }

  private finalizeRequestMetrics(key: string): void {
    const metrics = this.requestMetrics.get(key);
    if (metrics) {
      const duration = Date.now() - metrics.startTime;
      const cacheType = this.extractCacheType(key);
      
      // Track coalescing effectiveness
      this.metricsService.trackHistogram('vala_swap_coalescing_request_count', metrics.count, { cache_type: cacheType });
      this.metricsService.trackHistogram('vala_swap_coalescing_duration_seconds', duration / 1000, { cache_type: cacheType });
      
      // Calculate savings (requests saved by coalescing)
      const requestsSaved = Math.max(0, metrics.count - 1);
      if (requestsSaved > 0) {
        this.metricsService.incrementCounter('vala_swap_coalescing_requests_saved_total', { cache_type: cacheType }, requestsSaved);
      }
      
      this.logger.debug(`Coalescing metrics for ${key}: ${metrics.count} requests, ${requestsSaved} saved, ${duration}ms duration`);
      this.requestMetrics.delete(key);
    }
  }

  private cleanupRequestMetrics(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [key, metrics] of this.requestMetrics.entries()) {
      if (now - metrics.startTime > maxAge) {
        this.logger.warn(`Cleaning up stale request metrics for key: ${key}`);
        this.requestMetrics.delete(key);
      }
    }
  }

  /**
   * Get coalescing statistics for monitoring
   */
  getCoalescingStats(): {
    pendingRequests: number;
    activeMetrics: number;
    pendingKeys: string[];
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      activeMetrics: this.requestMetrics.size,
      pendingKeys: Array.from(this.pendingRequests.keys())
    };
  }

  private extractCacheType(key: string): string {
    const prefix = key.split(':')[0];
    return prefix || 'unknown';
  }
}
