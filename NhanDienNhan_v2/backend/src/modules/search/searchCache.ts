// ============================================================
// In-memory TTL cache for government database search results
// ============================================================

import { appConfig } from "@backend/config/env";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000; // Clean up expired entries every hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class SearchCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    ttlMs: number = appConfig.searchCacheTtlMs,
    maxEntries: number = appConfig.searchCacheMaxEntries,
    now: () => number = () => Date.now(),
  ) {
    this.ttlMs = ttlMs;
    this.maxEntries = Math.max(1, maxEntries);
    this.now = now;
    // Periodic cleanup for expired entries; the capacity limit bounds live entries.
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS).unref();
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, value: T): void {
    this.cleanup();

    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      this.evictOldestEntry();
    }

    this.store.set(key, {
      data: value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  get size(): number {
    return this.store.size;
  }

  /**
   * Build a normalized cache key from typed parts.
   * All parts are lowercased and trimmed to avoid case-sensitivity misses.
   */
  buildKey(type: string, ...parts: (string | null | undefined)[]): string {
    const normalized = parts
      .map((p) => (p ?? "").toLowerCase().trim())
      .join(":");
    return `${type}:${normalized}`;
  }

  private cleanup(): void {
    const now = this.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  private evictOldestEntry(): void {
    const oldestKey = this.store.keys().next().value;
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }
}

// Singleton instance shared across all providers
export const searchCache = new SearchCache();
