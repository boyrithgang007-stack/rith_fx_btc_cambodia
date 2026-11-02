import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { getCurrentUser } from "@/app/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 3;
const rateLimits = new Map<string, { count: number; resetsAt: number }>();
const LOCALES = new Set(["km-KH", "en-US", "en-GB", "th-TH", "vi-VN", "zh-CN", "ja-JP", "ko-KR", "fr-FR", "de-DE", "es-ES", "id-ID", "lo-LA"]);
const VOICES: Record<string, { locale: string; female: string; male: string }> = {
  km: { locale: "km-KH", female: "km-KH-SreymomNeural", male: "km-KH-PisethNeural" },
  en: { locale: "en-US", female: "en-US-JennyNeural", male: "en-US-GuyNeural" },
  th: { locale: "th-TH", female: "th-TH-PremwadeeNeural", male: "th-TH-NiwatNeural" },
  vi: { locale: "vi-VN", female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural" },
  "zh-Hans": { locale: "zh-CN", female: "zh-CN-XiaoxiaoNeural", male: "zh-CN-YunxiNeural" },
  ja: { locale: "ja-JP", female: "ja-JP-NanamiNeural", male: "ja-JP-KeitaNeural" },
  ko: { locale: "ko-KR", female: "ko-KR-SunHiNeural", male: "ko-KR-InJoonNeural" },
  fr: { locale: "fr-FR", female: "fr-FR-DeniseNeural", male: "fr-FR-HenriNeural" },
  de: { locale: "de-DE", female: "de-DE-KatjaNeural", male: "de-DE-ConradNeural" },
  es: { locale: "es-ES", female: "es-ES-ElviraNeural", male: "es-ES-AlvaroNeural" },
  id: { locale: "id-ID", female: "id-ID-GadisNeural", male: "id-ID-ArdiNeural" },
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function allowRequest(clientId: string) {
  const now = Date.now();
  if (rateLimits.size > 1000) {
    for (const [key, limit] of rateLimits) {
      if (limit.resetsAt <= now) rateLimits.delete(key);
    }
  }
  const existing = rateLimits.get(clientId);
  if (!existing || existing.resetsAt <= now) {
    rateLimits.set(clientId, { count: 1, resetsAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (existing.count >= MAX_REQUESTS_PER_WINDOW) return false;
  existing.count += 1;
  return true;
}

async function readBoundedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function runFfmpeg(args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg binary is unavailable on this platform."));
    const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", ...args], { cwd, windowsHide: true });
    let error = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error.trim() || `FFmpeg exited with code ${code}`)));
  });
}

function srtTime(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function xmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function getDurationSeconds(wav: Buffer) {
  const byteRate = wav.readUInt32LE(28);
  const dataIndex = wav.indexOf("data");
  if (dataIndex < 0 || !byteRate) return 0;
  const bytes = wav.readUInt32LE(dataIndex + 4);
  return bytes / byteRate;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    return jsonError("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  }
  if (!await getCurrentUser()) return jsonError("សូមចូលគណនីជាមុនសិន។", 401);

  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;
  const speechResource = process.env.AZURE_SPEECH_RESOURCE_NAME;
  const translatorKey = process.env.AZURE_TRANSLATOR_KEY;
  const translatorRegion = process.env.AZURE_TRANSLATOR_REGION;

  if (!speechKey || !speechRegion || !speechResource || !translatorKey || !translatorRegion
    || !/^[a-z0-9-]{2,63}$/.test(speechRegion)
    || !/^[a-z0-9-]{2,63}$/.test(translatorRegion)
    || !/^[a-z0-9-]{2,63}$/.test(speechResource)) {
    return jsonError("សូមកំណត់ Azure Speech និង Translator keys ក្នុងឯកសារ .env.local ជាមុនសិន។", 503);
  }

  const clientId = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!allowRequest(clientId)) {
    return Response.json({ error: "មានសំណើច្រើនពេក។ សូមរង់ចាំមួយនាទីសិន។" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }

  const rawContentLength = request.headers.get("content-length") || "0";
  if (!/^\d+$/.test(rawContentLength)) return jsonError("ទំហំសំណើមិនត្រឹមត្រូវទេ។", 400);
  const contentLength = Number(rawContentLength);
  if (contentLength > MAX_REQUEST_BYTES) return jsonError("ទំហំសំណើធំជាងកំណត់។", 413);
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) return jsonError("សំណើ upload ត្រូវប្រើ multipart/form-data។", 415);

  let form: FormData;
  try {
    const body = await readBoundedBody(request, MAX_REQUEST_BYTES);
    if (!body) return jsonError("ទំហំសំណើធំជាងកំណត់។", 413);
    form = await new Request(request.url, { method: "POST", headers: { "Content-Type": contentType }, body }).formData();
  } catch {
    return jsonError("ទម្រង់ upload មិនត្រឹមត្រូវទេ។", 400);
  }
  const video = form.get("video");
  const sourceLocale = String(form.get("sourceLocale") || "en-US");
  const targetLanguage = String(form.get("targetLanguage") || "km");
  const gender = String(form.get("voice") || "female");
  if (!(video instanceof File)) return jsonError("សូមជ្រើសវីដេអូដែលមានសំឡេង។", 400);
  if (video.size > MAX_UPLOAD_BYTES) return jsonError("ទំហំវីដេអូលើស 250 MB។", 413);
  if (!video.type.startsWith("video/")) return jsonError("ឯកសារដែលបានជ្រើសមិនមែនជាវីដេអូទេ។", 415);
  if (!LOCALES.has(sourceLocale) || !VOICES[targetLanguage]) return jsonError("ភាសាដែលបានជ្រើសមិនទាន់គាំទ្រទេ។", 400);

  const folder = await mkdtemp(path.join(tmpdir(), "soriya-dub-"));
  try {
    const inputPath = path.join(folder, "source-video");
    const audioPath = path.join(folder, "source-audio.wav");
    const voicePath = path.join(folder, "translated-voice.wav");
    const subtitlePath = path.join(folder, "translated-subtitles.srt");
    const outputPath = path.join(folder, "soriya-dubbed.mp4");
    await writeFile(inputPath, Buffer.from(await video.arrayBuffer()));

    try {
      await runFfmpeg(["-i", inputPath, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", audioPath], folder);
    } catch {
      return jsonError("មិនអាចរកឃើញសំឡេងក្នុងវីដេអូនេះទេ។", 422);
    }

    const speechBody = new FormData();
    speechBody.set("audio", new File([await readFile(audioPath)], "audio.wav", { type: "audio/wav" }));
    speechBody.set("definition", JSON.stringify({ locales: [sourceLocale] }));
    const transcriptionResponse = await fetch(`https://${speechResource}.cognitiveservices.azure.com/speechtotext/transcriptions:transcribe?api-version=2025-10-15`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": speechKey },
      body: speechBody,
      signal: AbortSignal.timeout(180_000),
    });
    if (!transcriptionResponse.ok) return jsonError("សេវាស្គាល់សំឡេងមិនអាចដំណើរការសំណើនេះបានទេ។", 502);
    const transcription = await transcriptionResponse.json() as {
      phrases?: { text: string; offsetMilliseconds: number; durationMilliseconds: number }[];
      combinedPhrases?: { text: string }[];
      durationMilliseconds?: number;
    };
    const phrases = (transcription.phrases || []).filter((phrase) => phrase.text?.trim());
    if (!phrases.length) return jsonError("មិនមានការនិយាយដែលអាចបកប្រែក្នុងវីដេអូនេះទេ។", 422);

    const translatedPhrases: string[] = [];
    for (let start = 0; start < phrases.length; start += 100) {
      const batch = phrases.slice(start, start + 100).map((phrase) => ({ Text: phrase.text }));
      const translatorUrl = new URL("https://api.cognitive.microsofttranslator.com/translate");
      translatorUrl.searchParams.set("api-version", "3.0");
      translatorUrl.searchParams.set("to", targetLanguage);
      const translationResponse = await fetch(translatorUrl, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": translatorKey, "Ocp-Apim-Subscription-Region": translatorRegion, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(90_000),
      });
      if (!translationResponse.ok) return jsonError("សេវាបកប្រែមិនអាចដំណើរការសំណើនេះបានទេ។", 502);
      const translations = await translationResponse.json() as { translations?: { text: string }[] }[];
      translatedPhrases.push(...translations.map((entry) => entry.translations?.[0]?.text || ""));
    }

    const voiceName = VOICES[targetLanguage][gender === "male" ? "male" : "female"];
    const fullScript = translatedPhrases.filter(Boolean).join(" ");
    const ssml = `<speak version="1.0" xml:lang="${VOICES[targetLanguage].locale}"><voice name="${voiceName}">${xmlEscape(fullScript)}</voice></speak>`;
    const voiceResponse = await fetch(`https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": speechKey, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm" },
      body: ssml,
      signal: AbortSignal.timeout(180_000),
    });
    if (!voiceResponse.ok) return jsonError("សេវាបង្កើតសំឡេងមិនអាចដំណើរការសំណើនេះបានទេ។", 502);
    const voiceBytes = Buffer.from(await voiceResponse.arrayBuffer());
    await writeFile(voicePath, voiceBytes);

    const srt = phrases.map((phrase, index) => `${index + 1}\n${srtTime(phrase.offsetMilliseconds)} --> ${srtTime(phrase.offsetMilliseconds + Math.max(phrase.durationMilliseconds, 900))}\n${translatedPhrases[index] || ""}\n`).join("\n");
    await writeFile(subtitlePath, `\uFEFF${srt}`, "utf8");
    const videoSeconds = (transcription.durationMilliseconds || 0) / 1000;
    const voiceSeconds = getDurationSeconds(voiceBytes);
    const ratio = videoSeconds > 0 && voiceSeconds > 0 ? voiceSeconds / videoSeconds : 1;
    let remainingTempo = ratio;
    const tempoFilters: string[] = [];
    while (remainingTempo > 2) { tempoFilters.push("atempo=2"); remainingTempo /= 2; }
    while (remainingTempo < 0.5) { tempoFilters.push("atempo=0.5"); remainingTempo /= 0.5; }
    tempoFilters.push(`atempo=${remainingTempo.toFixed(4)}`);
    await runFfmpeg([
      "-i", inputPath, "-i", voicePath, "-i", subtitlePath,
      "-map", "0:v:0", "-map", "1:a:0", "-map", "2:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", tempoFilters.join(","),
      "-c:s", "mov_text", "-metadata:s:s:0", `language=${targetLanguage}`,
      "-movflags", "+faststart", "-t", String(videoSeconds || voiceSeconds), outputPath,
    ], folder);
    const output = await readFile(outputPath);
    return new Response(output, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="soriya-dubbed.mp4"',
        "Content-Length": String(output.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Dubbing failed:", error);
    return jsonError(error instanceof Error ? error.message : "ដំណើរការវីដេអូមិនបានទេ។", 500);
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => undefined);
  }
}
