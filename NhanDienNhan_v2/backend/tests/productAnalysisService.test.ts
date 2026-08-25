import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProductSearchGate } from "../src/services/analyze/productAnalysisService.js";

const completeInteractiveResponse = {
  search_decision: {
    needs_web_search: false,
    search_reason: null,
  },
  data: {
    ingredients: [{ name: "active ingredient" }],
    pre_harvest_interval_days: 7,
  },
};

test("search gate preserves category and always-mode behavior", () => {
  assert.equal(
    evaluateProductSearchGate({
      schemaType: "fish_feed",
      searchMode: "always",
      responseData: {},
    }).shouldEnrich,
    false,
  );
  assert.equal(
    evaluateProductSearchGate({
      schemaType: "pesticide",
      searchMode: "always",
      responseData: {},
    }).shouldEnrich,
    true,
  );
  assert.equal(
    evaluateProductSearchGate({
      schemaType: "fertilizer",
      searchMode: "none",
      responseData: {},
    }).shouldEnrich,
    false,
  );
});

test("interactive search gate keeps the existing LLM and missing-field rules", () => {
  const complete = evaluateProductSearchGate({
    schemaType: "pesticide",
    searchMode: "interactive",
    responseData: JSON.stringify(completeInteractiveResponse),
  });
  assert.equal(complete.shouldEnrich, false);
  assert.deepEqual(
    complete.searchDecision,
    completeInteractiveResponse.search_decision,
  );

  assert.equal(
    evaluateProductSearchGate({
      schemaType: "pesticide",
      searchMode: "interactive",
      responseData: {
        ...completeInteractiveResponse,
        search_decision: { needs_web_search: true, search_reason: "missing" },
      },
    }).shouldEnrich,
    true,
  );
  assert.equal(
    evaluateProductSearchGate({
      schemaType: "pesticide",
      searchMode: "interactive",
      responseData: {
        ...completeInteractiveResponse,
        data: { ingredients: [], pre_harvest_interval_days: 7 },
      },
    }).shouldEnrich,
    true,
  );
  assert.equal(
    evaluateProductSearchGate({
      schemaType: "pesticide",
      searchMode: "interactive",
      responseData: {
        ...completeInteractiveResponse,
        data: {
          ingredients: [{ name: "active ingredient" }],
          pre_harvest_interval_days: null,
        },
      },
    }).shouldEnrich,
    true,
  );
});

test("interactive search gate retains invalid-JSON failure behavior", () => {
  assert.throws(
    () =>
      evaluateProductSearchGate({
        schemaType: "pesticide",
        searchMode: "interactive",
        responseData: "not-json",
      }),
    SyntaxError,
  );
});
