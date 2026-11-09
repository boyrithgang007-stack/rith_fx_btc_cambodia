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
    content?: { parts?: Array<GeminiPart & { mimeType?: string; data?: string }> };
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


export type GeminiWebSource = { title: string; url: string };
type GeminiGroundedResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
  }>;
};

export async function generateGeminiSearch(
  input: { model: string; instructions: string; prompt: string; maxOutputTokens: number; timeoutMs: number },
  fetcher: typeof fetch = fetch,
): Promise<{ text: string; sources: GeminiWebSource[] }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !isGeminiModel(input.model)) throw new Error("Gemini is not configured.");
  const response = await fetcher(`${GEMINI_API_BASE}/${encodeURIComponent(input.model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(input.timeoutMs),
    redirect: "error",
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.instructions }] },
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: input.maxOutputTokens, thinkingConfig: { thinkingLevel: "minimal" } },
    }),
  });
  if (!response.ok) throw new Error(`Gemini web search failed with status ${response.status}.`);
  const body = await response.json() as GeminiGroundedResponse;
  const candidate = body.candidates?.[0];
  if (candidate?.finishReason !== "STOP" || !Array.isArray(candidate.content?.parts)) {
    throw new Error("Gemini did not return a completed web-search response.");
  }
  const text = candidate.content.parts.map(part => part.text).filter((part): part is string => typeof part === "string").join("").trim();
  if (!text || text.length > 5000) throw new Error("Gemini returned an invalid web-search answer.");
  const seen = new Set<string>();
  const sources = (candidate.groundingMetadata?.groundingChunks ?? []).flatMap(chunk => {
    const rawUrl = chunk.web?.uri;
    if (!rawUrl) return [];
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || seen.has(url.href)) return [];
      seen.add(url.href);
      const title = chunk.web?.title?.trim().slice(0, 180) || url.hostname;
      return [{ title, url: url.href }];
    } catch { return []; }
  }).slice(0, 8);
  return { text, sources };
}
export async function generateGeminiSpeech(
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<{ audio: Uint8Array; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
  if (!apiKey || !isGeminiModel(model)) throw new Error("Gemini speech is not configured.");

  const khmer = /[\u1780-\u17ff]/.test(text);
  const voiceDirection = khmer
    ? "Warm, natural adult male Cambodian voice. Speak Khmer at a slightly brisk but clear pace, articulate each word distinctly, and pause naturally between short sentences. Do not read URLs or source labels aloud."
    : "Warm, natural adult male voice. Speak at a slightly brisk but clear pace, articulate each word distinctly, and pause naturally between short sentences. Do not read URLs or source labels aloud.";
  const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(45_000),
    redirect: "error",
    body: JSON.stringify({
      model,
      input: [{
        type: "user_input",
        content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: voiceDirection }] }],
      }],
      response_format: { type: "audio", mime_type: "audio/wav" },
      generation_config: { speech_config: [{ voice: "Charon" }] },
    }),
  });
  if (!response.ok) throw new Error(`Gemini speech request failed with status ${response.status}.`);

  const body = await response.json() as {
    status?: string;
    steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string; mime_type?: string }> }>;
  };
  const part = body.steps?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .find((item) => item.type === "audio" && typeof item.data === "string");
  if (body.status !== "completed" || !part?.data || !part.mime_type) {
    throw new Error("Gemini did not return completed speech audio.");
  }
  const audio = Buffer.from(part.data, "base64");
  if (audio.byteLength < 44 || audio.byteLength > 12_000_000) throw new Error("Gemini returned invalid speech audio.");
  return { audio: new Uint8Array(audio), mimeType: part.mime_type.toLowerCase() };
}
