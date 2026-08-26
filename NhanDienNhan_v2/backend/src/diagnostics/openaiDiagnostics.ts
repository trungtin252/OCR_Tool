import { TEST_MODEL } from "@backend/services/analyze/llmRegistry";
import { client } from "@backend/shared/llm/llmModel";

export async function testCallOpenAI() {
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
}
