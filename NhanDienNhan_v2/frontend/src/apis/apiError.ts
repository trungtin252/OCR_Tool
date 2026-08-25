type ApiErrorPayload = Record<string, unknown>;

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return typeof value === "object" && value !== null;
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * The backend uses `message` for its standard error contract, while older
 * endpoint-specific responses may expose `detail` or `error`.
 */
export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!isApiErrorPayload(payload)) {
    return fallback;
  }

  return (
    getNonEmptyString(payload.message) ??
    getNonEmptyString(payload.detail) ??
    getNonEmptyString(payload.error) ??
    fallback
  );
}

export function getNetworkErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}
