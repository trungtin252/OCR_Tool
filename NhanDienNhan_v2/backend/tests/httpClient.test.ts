import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithRetry } from "../src/modules/search/httpClient.js";

test("fetchWithRetry returns a successful response without retries", async () => {
  const originalFetch = globalThis.fetch;
  let receivedUrl: string | undefined;

  globalThis.fetch = async (input) => {
    receivedUrl = String(input);
    return new Response("government search result", { status: 200 });
  };

  try {
    const result = await fetchWithRetry("https://example.test/search", 50);

    assert.equal(result, "government search result");
    assert.equal(receivedUrl, "https://example.test/search");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
