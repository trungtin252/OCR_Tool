export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("statusCode" in error) ||
    typeof error.statusCode !== "number" ||
    !error.statusCode
  ) {
    return undefined;
  }

  return error.statusCode;
}
