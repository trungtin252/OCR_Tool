import { zodTextFormat } from "openai/helpers/zod";
import type { SchemaType } from "@backend/validation/types";
import { formatDatesInResponse } from "@backend/shared/postprocessing/dateProcessor";
import { client } from "@backend/shared/llm/llmModel";
import {
  FALLBACK_MODEL,
  getModelForSchemaType,
  getResponseSchema,
  getTestResponseSchema,
  TEST_MODEL,
} from "./llmRegistry";
import {
  buildChatImageInputs,
  buildResponsesImageInputs,
  createStructuredChatCompletion,
} from "@backend/shared/llm/llmGateway";

// deprecated
export const processImagesWithOpenAI = async (
  imageBuffers: Buffer[],
  imageTypes: string[],
  prompt: string = "what's in these images?",
  schemaType: SchemaType = "pesticide",
  isParsed: boolean = false,
  formatDates: boolean = false,
) => {
  try {
    const imageInputs = buildResponsesImageInputs(imageBuffers, imageTypes);
    const targetSchema = getResponseSchema(schemaType);

    const response = await client.responses.parse({
      model: getModelForSchemaType(schemaType),
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }, ...imageInputs],
        },
      ],
      text: {
        format: zodTextFormat(targetSchema, "schema"),
      },
    });

    let parsedResponse = isParsed
      ? JSON.parse(response.output_text)
      : response.output_text;

    // Format dates if requested (independent of isParsed)
    if (formatDates) {
      // Parse if not already parsed
      if (typeof parsedResponse === "string") {
        parsedResponse = JSON.parse(parsedResponse);
      }
      // Format dates
      parsedResponse = formatDatesInResponse(parsedResponse);
      // Stringify back if isParsed was false
      if (!isParsed) {
        parsedResponse = JSON.stringify(parsedResponse);
      }
    }

    return {
      success: true,
      response: parsedResponse,
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
};

export const processImagesWithOpenAI_chatCompletions = async (
  imageBuffers: Buffer[],
  imageTypes: string[],
  prompt: string = "what's in these images?",
  schemaType: SchemaType = "pesticide",
  isParsed: boolean = false,
  formatDates: boolean = false,
  withSearchSchema: boolean = false,
) => {
  try {
    const imageInputs = buildChatImageInputs(imageBuffers, imageTypes);

    // Định dạng chuẩn của OpenAI Chat Completions cho hình ảnh
    // Lựa chọn schema dựa trên tham số
    const targetSchema = getResponseSchema(schemaType, withSearchSchema);

    const response = await createStructuredChatCompletion({
      model: getModelForSchemaType(schemaType),
      prompt,
      imageInputs,
      responseSchema: targetSchema,
      fallbackModel: FALLBACK_MODEL,
    });

    const outputText = response.choices[0]?.message?.content;

    if (!outputText) {
      throw new Error("No content received from model.");
    }

    // Keep the established response contract: structured-output is requested
    // from the provider, but an imperfect model response must not turn into a
    // server error after the request has otherwise completed successfully.
    let parsedResponse: unknown = isParsed
      ? JSON.parse(outputText)
      : outputText;

    if (isParsed) {
      const validationResult = targetSchema.safeParse(parsedResponse);
      if (!validationResult.success) {
        console.warn(
          "Model response schema validation failed; returning model output unchanged:",
          validationResult.error.issues,
        );
      }
    }

    // Format dates if requested (independent of isParsed)
    if (formatDates) {
      // Parse if not already parsed
      if (typeof parsedResponse === "string") {
        parsedResponse = JSON.parse(parsedResponse);
      }
      // Format dates
      parsedResponse = formatDatesInResponse(parsedResponse);
      // Stringify back if isParsed was false
      if (!isParsed) {
        parsedResponse = JSON.stringify(parsedResponse);
      }
    }

    return {
      success: true,
      response: parsedResponse,
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
};

export const processImagesTest = async (
  imageBuffers: Buffer[],
  imageTypes: string[],
  prompt: string = "what's in these images?",
  schemaType: SchemaType | "" = "pesticide",
  isParsed: boolean = false,
  formatDates: boolean = false,
) => {
  try {
    const imageInputs = buildChatImageInputs(imageBuffers, imageTypes);

    // Định dạng chuẩn của OpenAI Chat Completions cho hình ảnh
    // Lựa chọn schema dựa trên tham số
    const targetSchema = getTestResponseSchema(schemaType);

    // Gọi hàm qua client.chat.completions.create
    const response = await createStructuredChatCompletion({
      model: TEST_MODEL,
      prompt,
      imageInputs,
      ...(targetSchema ? { responseSchema: targetSchema } : {}),
    });

    const outputText = response.choices[0]?.message?.content;

    if (!outputText) {
      throw new Error("No content received from model.");
    }

    let parsedResponse: unknown = outputText;
    if (targetSchema) {
      const outputObject = JSON.parse(outputText);
      const validationResult = targetSchema.safeParse(outputObject);
      if (!validationResult.success) {
        console.error(
          "Test model response schema validation failed:",
          validationResult.error.issues,
        );
        throw new Error("Model response does not match the expected schema");
      }
      parsedResponse = isParsed
        ? validationResult.data
        : JSON.stringify(validationResult.data);
    } else if (isParsed || formatDates) {
      parsedResponse = JSON.parse(outputText);
    }

    // Format dates if requested (independent of isParsed)
    if (formatDates) {
      // Parse if not already parsed
      if (typeof parsedResponse === "string") {
        parsedResponse = JSON.parse(parsedResponse);
      }
      // Format dates
      parsedResponse = formatDatesInResponse(parsedResponse);
      // Stringify back if isParsed was false
      if (!isParsed) {
        parsedResponse = JSON.stringify(parsedResponse);
      }
    }

    return {
      success: true,
      response: parsedResponse,
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
};

export const testCallOpenAI = async () => {
  const response = await client.chat.completions.create({
    model: TEST_MODEL,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      {
        role: "user",
        content: "bạn là model AI nào? Hãy giới thiệu về mình bằng tiếng Việt.",
      },
    ],
  });
  if (response.choices[0]) {
    console.log(response.choices[0].message);
  }
};
