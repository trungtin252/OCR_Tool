import dotenv from "dotenv";

dotenv.config({ quiet: true });

export const DEFAULT_PORT = 5000;
export const DEFAULT_LLM_TIMEOUT_MS = 60_000;
export const DEFAULT_SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
export const DEFAULT_SEARCH_CACHE_MAX_ENTRIES = 200;

type Environment = Readonly<Record<string, string | undefined>>;

export interface AppConfig {
  geminiApiKey: string | undefined;
  port: number;
  corsOrigins: string[];
  testEndpointsEnabled: boolean;
  llmTimeoutMs: number;
  searchCacheTtlMs: number;
  searchCacheMaxEntries: number;
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallback: number,
  maximum?: number,
): number {
  const value = Number(rawValue);
  const isValid =
    Number.isSafeInteger(value) &&
    value > 0 &&
    (maximum === undefined || value <= maximum);

  return isValid ? value : fallback;
}

function parseCorsOrigins(rawValue: string | undefined): string[] {
  return (rawValue ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Converts process environment values into the runtime configuration.
 * Missing or malformed numeric values deliberately fall back to the legacy
 * defaults, so configuration hardening does not change current behavior.
 */
export function createAppConfig(
  environment: Environment = process.env,
): AppConfig {
  return {
    geminiApiKey: environment.GEMINI_API_KEY,
    port: parsePositiveInteger(environment.PORT, DEFAULT_PORT, 65_535),
    corsOrigins: parseCorsOrigins(environment.CORS_ORIGINS),
    // Keep the exact legacy rule: only the lowercase string "false" disables
    // the diagnostic endpoints.
    testEndpointsEnabled: environment.ENABLE_TEST_ENDPOINTS !== "false",
    llmTimeoutMs: parsePositiveInteger(
      environment.LLM_TIMEOUT_MS,
      DEFAULT_LLM_TIMEOUT_MS,
    ),
    searchCacheTtlMs: parsePositiveInteger(
      environment.SEARCH_CACHE_TTL_MS,
      DEFAULT_SEARCH_CACHE_TTL_MS,
    ),
    searchCacheMaxEntries: parsePositiveInteger(
      environment.SEARCH_CACHE_MAX_ENTRIES,
      DEFAULT_SEARCH_CACHE_MAX_ENTRIES,
    ),
  };
}

export const appConfig = createAppConfig();
