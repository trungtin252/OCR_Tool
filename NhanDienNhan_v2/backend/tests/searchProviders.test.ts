import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  parseFertilizerPage,
  FertilizerProvider,
} from "../src/modules/search/fertilizerProvider.js";
import {
  parseDetailPage,
  parseSearchResultPage,
  PesticideProvider,
} from "../src/modules/search/pesticideProvider.js";
import {
  getSearchProvider,
  SEARCH_PROVIDER_REGISTRY,
} from "../src/modules/search/providerRegistry.js";

function readFixture(name: string): string {
  return readFileSync(
    resolve(process.cwd(), "tests", "fixtures", "search", name),
    "utf8",
  );
}

test("pesticide parser preserves the supported government-site HTML shape", () => {
  assert.deepEqual(
    parseSearchResultPage(readFixture("pesticide-search.html")),
    [
      {
        name: "Sample Pesticide",
        activeIngredients: "Ingredient A 10%",
        detailUrl: "https://danhmuc.thuocbvtv.com/thuoc/sample-pesticide",
        company: "Example Co.",
      },
    ],
  );
  assert.deepEqual(
    parseDetailPage(
      readFixture("pesticide-detail.html"),
      "https://danhmuc.thuocbvtv.com/thuoc/sample-pesticide",
    ),
    {
      product_name: "Sample Pesticide",
      registrant: "Example Co.",
      source_url: "https://danhmuc.thuocbvtv.com/thuoc/sample-pesticide",
    },
  );
});

test("fertilizer parser preserves the supported government-site HTML shape", () => {
  assert.deepEqual(
    parseFertilizerPage(
      readFixture("fertilizer-product.html"),
      "http://113.190.254.147/PhanBon/en/phanbonchungnhan/sample",
    ),
    {
      product_name: "Sample Fertilizer",
      source_url: "http://113.190.254.147/PhanBon/en/phanbonchungnhan/sample",
    },
  );
});

test("provider registry selects the established provider per category", () => {
  assert.equal(
    getSearchProvider("pesticide"),
    SEARCH_PROVIDER_REGISTRY.pesticide,
  );
  assert.equal(
    getSearchProvider("fertilizer"),
    SEARCH_PROVIDER_REGISTRY.fertilizer,
  );
  assert.ok(SEARCH_PROVIDER_REGISTRY.pesticide instanceof PesticideProvider);
  assert.ok(SEARCH_PROVIDER_REGISTRY.fertilizer instanceof FertilizerProvider);
});
