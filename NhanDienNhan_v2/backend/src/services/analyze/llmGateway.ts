import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { client } from "@backend/utils/llmModel";

const MIME_DATA_URL_PREFIXES: Record<string, string> = {
  "image/jpeg": "data:image/jpeg;base64,",
  "image/png": "data:image/png;base64,",
  "image/gif": "data:image/gif;base64,",
  "image/webp": "data:image/webp;base64,",
};
const DEFAULT_DATA_URL_PREFIX = "data:image/jpeg;base64,";

interface ChatImageInput {
  type: "image_url";
  image_url: {
    url: string;
    detail: "auto";
  };
}

interface ResponsesImageInput {
  type: "input_image";
  image_url: string;
  detail: "auto";
}

interface StructuredChatCompletionOptions {
  model: string;
  prompt: string;
  imageInputs: ChatImageInput[];
  responseSchema?: z.ZodType;
  fallbackModel?: string;
}

interface StructuredTextCompletionOptions {
  model: string;
  systemPrompt: string;
  userMessage: string;
  responseSchema: z.ZodType;
}

interface ProviderStatusError {
  status: number;
}

function toDataUrl(imageBuffer: Buffer, imageType: string | undefined): string {
  const prefix =
    MIME_DATA_URL_PREFIXES[imageType ?? ""] ?? DEFAULT_DATA_URL_PREFIX;
  return `${prefix}${imageBuffer.toString("base64")}`;
}

export function buildChatImageInputs(
  imageBuffers: Buffer[],
  imageTypes: string[],
): ChatImageInput[] {
  return imageBuffers.map((buffer, index) => ({
    type: "image_url",
    image_url: {
      url: toDataUrl(buffer, imageTypes[index]),
      detail: "auto",
    },
  }));
}

export function buildResponsesImageInputs(
  imageBuffers: Buffer[],
  imageTypes: string[],
): ResponsesImageInput[] {
  return imageBuffers.map((buffer, index) => ({
    type: "input_image",
    image_url: toDataUrl(buffer, imageTypes[index]),
    detail: "auto",
  }));
}

export function isFallbackEligibleError(
  error: unknown,
): error is ProviderStatusError {
  if (
    typeof error !== "object" ||
    error === null ||
    !("status" in error) ||
    typeof error.status !== "number"
  ) {
    return false;
  }

  return error.status === 429 || error.status === 503;
}

export async function createStructuredChatCompletion({
  model,
  prompt,
  imageInputs,
  responseSchema,
  fallbackModel,
}: StructuredChatCompletionOptions) {
  const createCompletion = (requestedModel: string) =>
    client.chat.completions.create({
      model: requestedModel,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }, ...imageInputs],
        },
      ],
      ...(responseSchema
        ? { response_format: zodResponseFormat(responseSchema, "schema_name") }
        : {}),
    });

  try {
    return await createCompletion(model);
  } catch (error) {
    if (!fallbackModel || !isFallbackEligibleError(error)) {
      throw error;
    }

    console.warn(
      `Primary model ${model} failed with status ${error.status}. Falling back to ${fallbackModel}...`,
    );
    return createCompletion(fallbackModel);
  }
}

export function createStructuredTextCompletion({
  model,
  systemPrompt,
  userMessage,
  responseSchema,
}: StructuredTextCompletionOptions) {
  return client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: zodResponseFormat(responseSchema, "schema_name"),
  });
}
