import { getCurrentUser, allowAuthAttempt } from "@/app/lib/auth";
import { isSameOriginRequest, readLimitedJson } from "@/app/lib/auth-http";
import { answerAssistant, assistantConfigured, type AssistantMessage } from "@/app/lib/general-assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin requests are not allowed." }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "សូមចូលគណនីរបស់អ្នក មុនប្រើ RFX assistant។" }, 401);
  if (!allowAuthAttempt(`assistant:${user.id}`, 10, 60_000)) {
    return json({ error: "សូមរង់ចាំបន្តិច មុនសួរសំណួរបន្ទាប់។" }, 429);
  }

  const body = await readLimitedJson(request, 64_000);
  if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) {
    return json({ error: "សារសន្ទនាមិនត្រឹមត្រូវទេ។" }, 400);
  }
  const messages: AssistantMessage[] = [];
  for (const item of body.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return json({ error: "សារសន្ទនាមិនត្រឹមត្រូវទេ។" }, 400);
    const message = item as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string"
        || !message.content.trim() || message.content.length > 1200) {
      return json({ error: "សារនីមួយៗត្រូវមានអក្សរមិនលើស 1,200 តួ។" }, 400);
    }
    messages.push({ role: message.role, content: message.content.trim() });
  }
  if (messages.at(-1)?.role !== "user") return json({ error: "សូមផ្ញើសំណួររបស់អ្នក។" }, 400);
  if (!assistantConfigured()) return json({ error: "សេវា AI មិនទាន់បានកំណត់នៅលើ server ទេ។" }, 503);

  try {
    return json(await answerAssistant(messages));
  } catch {
    return json({ error: "មិនអាចបង្កើតចម្លើយបានទេ។ សូមសាកល្បងម្ដងទៀត។" }, 502);
  }
}
