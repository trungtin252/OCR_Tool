// ============================================================
// In-memory TTL cache for government database search results
// ============================================================

import { appConfig } from "@backend/config/env";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000; // Clean up expired entries every hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SearchCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = appConfig.searchCacheTtlMs) {
    this.ttlMs = ttlMs;
    // Periodic cleanup to prevent unbounded memory growth
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS).unref();
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + this.ttlMs,
    });
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
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton instance shared across all providers
export const searchCache = new SearchCache();
