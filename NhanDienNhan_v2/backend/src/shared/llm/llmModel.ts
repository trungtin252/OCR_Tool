import OpenAI from "openai";
import { appConfig } from "@backend/config/env";

// const client = new OpenAI({
//   apiKey: process.env.wokushop_api_key,
//   baseURL: "https://llm.wokushop.com/v1/",
// });

export const client = new OpenAI({
  apiKey: appConfig.geminiApiKey,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  timeout: appConfig.llmTimeoutMs,
});
