type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiSchema = Record<string, unknown>;

type GeminiRequest = {
  model: string;
  instructions: string;
  prompt: string;
  schema: GeminiSchema;
  maxOutputTokens: number;
  timeoutMs: number;
  image?: { mimeType: string; data: string };
};

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: GeminiPart[] };
  }>;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

export function isGeminiModel(value: string) {
  return MODEL_PATTERN.test(value);
}

export async function generateGeminiJson(
  input: GeminiRequest,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !isGeminiModel(input.model)) throw new Error("Gemini is not configured.");

  const parts: GeminiPart[] = [{ text: input.prompt }];
  if (input.image) parts.push({ inlineData: input.image });

  const response = await fetcher(
    `${GEMINI_API_BASE}/${encodeURIComponent(input.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(input.timeoutMs),
      redirect: "error",
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.instructions }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: input.schema,
          maxOutputTokens: input.maxOutputTokens,
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}.`);

  const body = await response.json() as GeminiResponse;
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason !== "STOP" || !Array.isArray(candidate.content?.parts)) {
    throw new Error("Gemini did not return a completed response.");
  }
  const text = candidate.content.parts
    .map((part) => part.text)
    .filter((part): part is string => typeof part === "string")
    .join("");
  if (!text || text.length > 24_000) throw new Error("Gemini returned an invalid response.");
  return text;
}
