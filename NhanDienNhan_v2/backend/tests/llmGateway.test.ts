import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatImageInputs,
  buildResponsesImageInputs,
  isFallbackEligibleError,
} from "../src/shared/llm/llmGateway.js";

test("LLM gateway produces the same image data URLs for both SDK APIs", () => {
  const images = [Buffer.from("image-one"), Buffer.from("image-two")];
  const imageTypes = ["image/png", "unsupported/type"];

  assert.deepEqual(buildChatImageInputs(images, imageTypes), [
    {
      type: "image_url",
      image_url: {
        url: "data:image/png;base64,aW1hZ2Utb25l",
        detail: "auto",
      },
    },
    {
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,aW1hZ2UtdHdv",
        detail: "auto",
      },
    },
  ]);
  assert.deepEqual(buildResponsesImageInputs(images, imageTypes), [
    {
      type: "input_image",
      image_url: "data:image/png;base64,aW1hZ2Utb25l",
      detail: "auto",
    },
    {
      type: "input_image",
      image_url: "data:image/jpeg;base64,aW1hZ2UtdHdv",
      detail: "auto",
    },
  ]);
});

test("fallback remains limited to the legacy 429 and 503 provider failures", () => {
  assert.equal(isFallbackEligibleError({ status: 429 }), true);
  assert.equal(isFallbackEligibleError({ status: 503 }), true);
  assert.equal(isFallbackEligibleError({ status: 500 }), false);
  assert.equal(isFallbackEligibleError({ status: "503" }), false);
  assert.equal(isFallbackEligibleError(new Error("network error")), false);
});
