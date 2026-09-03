import assert from "node:assert/strict";
import test from "node:test";
import {
  createAppConfig,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_OCR_ARCHIVE_DIR,
  DEFAULT_OCR_ARCHIVE_MIN_FREE_BYTES,
  DEFAULT_PORT,
  DEFAULT_SEARCH_CACHE_MAX_ENTRIES,
  DEFAULT_SEARCH_CACHE_TTL_MS,
  DEFAULT_SEARCH_HTTP_CONCURRENCY,
  DEFAULT_SEARCH_HTTP_MAX_RETRIES,
  DEFAULT_SEARCH_HTTP_TIMEOUT_MS,
} from "../src/config/env.js";

test("environment defaults preserve the existing runtime behavior", () => {
  const config = createAppConfig({});

  assert.deepEqual(config, {
    geminiApiKey: undefined,
    port: DEFAULT_PORT,
    corsOrigins: [],
    testEndpointsEnabled: true,
    llmTimeoutMs: DEFAULT_LLM_TIMEOUT_MS,
    searchCacheTtlMs: DEFAULT_SEARCH_CACHE_TTL_MS,
    searchCacheMaxEntries: DEFAULT_SEARCH_CACHE_MAX_ENTRIES,
    searchHttpTimeoutMs: DEFAULT_SEARCH_HTTP_TIMEOUT_MS,
    searchHttpMaxRetries: DEFAULT_SEARCH_HTTP_MAX_RETRIES,
    searchHttpConcurrency: DEFAULT_SEARCH_HTTP_CONCURRENCY,
    ocrArchiveEnabled: true,
    ocrArchiveDir: DEFAULT_OCR_ARCHIVE_DIR,
    ocrArchiveMinFreeBytes: DEFAULT_OCR_ARCHIVE_MIN_FREE_BYTES,
  });
});

test("environment configuration parses valid values without changing semantics", () => {
  const config = createAppConfig({
    GEMINI_API_KEY: "test-key",
    PORT: "8080",
    CORS_ORIGINS: " https://dev.example.com,https://app.example.com , ",
    ENABLE_TEST_ENDPOINTS: "false",
    LLM_TIMEOUT_MS: "45000",
    SEARCH_CACHE_TTL_MS: "1800000",
    SEARCH_CACHE_MAX_ENTRIES: "150",
    SEARCH_HTTP_TIMEOUT_MS: "12000",
    SEARCH_HTTP_MAX_RETRIES: "0",
    SEARCH_HTTP_CONCURRENCY: "3",
    OCR_ARCHIVE_ENABLED: "true",
    OCR_ARCHIVE_DIR: "/app/data/ocr-history",
    OCR_ARCHIVE_MIN_FREE_BYTES: "2048",
  });

  assert.deepEqual(config, {
    geminiApiKey: "test-key",
    port: 8080,
    corsOrigins: ["https://dev.example.com", "https://app.example.com"],
    testEndpointsEnabled: false,
    llmTimeoutMs: 45000,
    searchCacheTtlMs: 1800000,
    searchCacheMaxEntries: 150,
    searchHttpTimeoutMs: 12000,
    searchHttpMaxRetries: 0,
    searchHttpConcurrency: 3,
    ocrArchiveEnabled: true,
    ocrArchiveDir: "/app/data/ocr-history",
    ocrArchiveMinFreeBytes: 2048,
  });
});

test("invalid numeric configuration falls back to safe legacy defaults", () => {
  const config = createAppConfig({
    PORT: "70000",
    LLM_TIMEOUT_MS: "0",
    SEARCH_CACHE_TTL_MS: "not-a-number",
    SEARCH_CACHE_MAX_ENTRIES: "0",
    SEARCH_HTTP_TIMEOUT_MS: "not-a-number",
    SEARCH_HTTP_MAX_RETRIES: "-1",
    SEARCH_HTTP_CONCURRENCY: "11",
    ENABLE_TEST_ENDPOINTS: "FALSE",
    OCR_ARCHIVE_ENABLED: "false",
    OCR_ARCHIVE_DIR: "   ",
    OCR_ARCHIVE_MIN_FREE_BYTES: "-1",
  });

  assert.equal(config.port, DEFAULT_PORT);
  assert.equal(config.llmTimeoutMs, DEFAULT_LLM_TIMEOUT_MS);
  assert.equal(config.searchCacheTtlMs, DEFAULT_SEARCH_CACHE_TTL_MS);
  assert.equal(config.searchCacheMaxEntries, DEFAULT_SEARCH_CACHE_MAX_ENTRIES);
  assert.equal(config.searchHttpTimeoutMs, DEFAULT_SEARCH_HTTP_TIMEOUT_MS);
  assert.equal(config.searchHttpMaxRetries, DEFAULT_SEARCH_HTTP_MAX_RETRIES);
  assert.equal(config.searchHttpConcurrency, DEFAULT_SEARCH_HTTP_CONCURRENCY);
  assert.equal(config.testEndpointsEnabled, true);
  assert.equal(config.ocrArchiveEnabled, false);
  assert.equal(config.ocrArchiveDir, DEFAULT_OCR_ARCHIVE_DIR);
  assert.equal(
    config.ocrArchiveMinFreeBytes,
    DEFAULT_OCR_ARCHIVE_MIN_FREE_BYTES,
  );
});
