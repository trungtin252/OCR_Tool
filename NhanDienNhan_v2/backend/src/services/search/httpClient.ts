// ============================================================
// Rate-limited HTTP client for scraping government databases
// ============================================================

import { appConfig } from "@backend/config/env";

const DEFAULT_TIMEOUT_MS = appConfig.searchHttpTimeoutMs;
const MAX_RETRIES = appConfig.searchHttpMaxRetries;
const CONCURRENCY_LIMIT = appConfig.searchHttpConcurrency;

// Simple semaphore to cap concurrent requests to government sites
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSemaphore(): Promise<void> {
  return new Promise((resolve) => {
    if (activeRequests < CONCURRENCY_LIMIT) {
      activeRequests++;
      resolve();
    } else {
      waitQueue.push(() => {
        activeRequests++;
        resolve();
      });
    }
  });
}

function releaseSemaphore(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

/**
 * Fetch a URL with:
 * - Configurable timeout
 * - Automatic retry with exponential back-off
 * - Concurrency cap (max 2 simultaneous requests)
 *
 * Returns the response text, or throws on final failure.
 */
export async function fetchWithRetry(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  await acquireSemaphore();

  try {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential back-off: 1s, 2s
        await new Promise((r) => setTimeout(r, 1_000 * attempt));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; ProductLabelBot/1.0; +info@example.com)",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
          },
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }

        return await response.text();
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        console.warn(
          `[httpClient] Attempt ${attempt + 1} failed for ${url}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    throw (
      lastError ??
      new Error(`Failed to fetch ${url} after ${MAX_RETRIES + 1} attempts`)
    );
  } finally {
    releaseSemaphore();
  }
}
