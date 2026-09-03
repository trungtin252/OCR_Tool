import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatImageInputs,
  buildResponsesImageInputs,
  createStructuredChatCompletion,
  isFallbackEligibleError,
} from "../src/shared/llm/llmGateway.js";
import { client } from "../src/shared/llm/llmModel.js";

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

test("empty-content fallback is opt-in for the growing-area certificate flow", async () => {
  type CreateCompletion = typeof client.chat.completions.create;
  const completions = client.chat.completions as unknown as {
    create: CreateCompletion;
  };
  const originalCreate = completions.create;
  const requestedModels: string[] = [];

  completions.create = (async (request: Parameters<CreateCompletion>[0]) => {
    requestedModels.push(request.model);
    return {
      choices: [
        {
          finish_reason: request.model === "primary-model" ? "length" : "stop",
          message: {
            content: request.model === "primary-model" ? null : "{}",
            refusal: null,
          },
        },
      ],
    };
  }) as CreateCompletion;

  try {
    const response = await createStructuredChatCompletion({
      model: "primary-model",
      fallbackModel: "fallback-model",
      fallbackOnEmptyContent: true,
      prompt: "test",
      imageInputs: [],
    });

    assert.deepEqual(requestedModels, ["primary-model", "fallback-model"]);
    assert.equal(response.choices[0]?.message.content, "{}");
  } finally {
    completions.create = originalCreate;
  }
});
