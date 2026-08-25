import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const configuredTimeout = Number(process.env.LLM_TIMEOUT_MS);
const llmTimeoutMs =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 60_000;

// const client = new OpenAI({
//   apiKey: process.env.wokushop_api_key,
//   baseURL: "https://llm.wokushop.com/v1/",
// });

export const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  timeout: llmTimeoutMs,
});
