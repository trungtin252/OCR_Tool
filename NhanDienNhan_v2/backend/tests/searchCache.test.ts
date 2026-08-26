import assert from "node:assert/strict";
import test from "node:test";
import { SearchCache } from "../src/modules/search/searchCache.js";

test("SearchCache normalizes equivalent lookup keys", () => {
  const cache = new SearchCache(60_000, 2);

  assert.equal(
    cache.buildKey("pesticide", "  Ridomil Gold  ", "  VN-123  "),
    "pesticide:ridomil gold:vn-123",
  );
});

test("SearchCache evicts the oldest distinct entry at its capacity", () => {
  const cache = new SearchCache(60_000, 2);

  cache.set("first", { value: 1 });
  cache.set("second", { value: 2 });
  cache.set("third", { value: 3 });

  assert.equal(cache.size, 2);
  assert.equal(cache.get("first"), null);
  assert.deepEqual(cache.get("second"), { value: 2 });
  assert.deepEqual(cache.get("third"), { value: 3 });
});

test("SearchCache replacing an existing key does not evict another entry", () => {
  const cache = new SearchCache(60_000, 2);

  cache.set("first", { value: 1 });
  cache.set("second", { value: 2 });
  cache.set("first", { value: 10 });

  assert.equal(cache.size, 2);
  assert.deepEqual(cache.get("first"), { value: 10 });
  assert.deepEqual(cache.get("second"), { value: 2 });
});

test("SearchCache removes expired entries before applying its capacity limit", () => {
  let now = 1_000;
  const cache = new SearchCache(100, 1, () => now);

  cache.set("expired", { value: 1 });
  now = 1_101;
  cache.set("current", { value: 2 });

  assert.equal(cache.size, 1);
  assert.equal(cache.get("expired"), null);
  assert.deepEqual(cache.get("current"), { value: 2 });
});
