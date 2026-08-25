import assert from "node:assert/strict";
import test from "node:test";
import {
  createAppConfig,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_PORT,
  DEFAULT_SEARCH_CACHE_TTL_MS,
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
  });

  assert.deepEqual(config, {
    geminiApiKey: "test-key",
    port: 8080,
    corsOrigins: ["https://dev.example.com", "https://app.example.com"],
    testEndpointsEnabled: false,
    llmTimeoutMs: 45000,
    searchCacheTtlMs: 1800000,
  });
});

test("invalid numeric configuration falls back to safe legacy defaults", () => {
  const config = createAppConfig({
    PORT: "70000",
    LLM_TIMEOUT_MS: "0",
    SEARCH_CACHE_TTL_MS: "not-a-number",
    ENABLE_TEST_ENDPOINTS: "FALSE",
  });

  assert.equal(config.port, DEFAULT_PORT);
  assert.equal(config.llmTimeoutMs, DEFAULT_LLM_TIMEOUT_MS);
  assert.equal(config.searchCacheTtlMs, DEFAULT_SEARCH_CACHE_TTL_MS);
  assert.equal(config.testEndpointsEnabled, true);
});
