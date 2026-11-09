import { getCurrentUser, allowAuthAttempt } from "@/app/lib/auth";
import { isSameOriginRequest, readLimitedJson } from "@/app/lib/auth-http";
import { generateGeminiSpeech } from "@/app/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Cross-origin requests are not allowed." }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "សូមចូលគណនីរបស់អ្នក មុនប្រើ RFX assistant។" }, 401);
  if (!allowAuthAttempt(`assistant-speech:${user.id}`, 8, 60_000)) {
    return json({ error: "សូមរង់ចាំបន្តិច មុនបង្កើតសំឡេងបន្ទាប់។" }, 429);
  }
  const body = await readLimitedJson(request, 10_000);
  if (typeof body?.text !== "string" || !body.text.trim() || body.text.length > 5000) {
    return json({ error: "អត្ថបទសម្រាប់បង្កើតសំឡេងមិនត្រឹមត្រូវទេ។" }, 400);
  }

  try {
    const { audio, mimeType } = await generateGeminiSpeech(body.text.trim());
    if (mimeType !== "audio/wav" || audio[0] !== 0x52 || audio[1] !== 0x49 || audio[2] !== 0x46 || audio[3] !== 0x46) {
      return json({ error: "សេវាសំឡេងបានត្រឡប់ទ្រង់ទ្រាយដែលមិនអាចចាក់បានទេ។" }, 502);
    }
    return new Response(Buffer.from(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "មិនអាចបង្កើតសំឡេងខ្មែរបានទេ។ សូមពិនិត្យការកំណត់ Gemini TTS ហើយសាកម្ដងទៀត។" }, 502);
  }
}