const MAX_AUTH_BODY_BYTES = 8 * 1024;

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if(fetchSite === "cross-site")return false;
  if(!origin)return true;
  try {
    const incoming=new URL(origin),target=new URL(request.url);
    // Next's internal URL may canonicalize 127.0.0.1 to localhost. The actual Host
    // still identifies the browser-facing origin; never trust forwarded hosts here.
    const host=request.headers.get("host")??target.host;
    return incoming.origin===origin&&!incoming.username&&!incoming.password
      &&incoming.protocol===target.protocol&&incoming.host===host;
  }catch{return false;}
}

export async function readAuthJson(request: Request): Promise<Record<string, unknown> | null> {
  return readLimitedJson(request, MAX_AUTH_BODY_BYTES);
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) return null;
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
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
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function authJson(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
