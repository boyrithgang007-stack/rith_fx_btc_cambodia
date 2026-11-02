import { execute, query } from "./database";

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "x", "telegram", "website"] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
export type PublicSocialLink = { id: string; platform: SocialPlatform; url: string };
const platformSet = new Set<string>(SOCIAL_PLATFORMS);

export class PublicSocialLinkError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function listPublicSocialLinks() {
  return query<PublicSocialLink>("SELECT id,platform,url FROM public_social_links ORDER BY created_at ASC,id ASC");
}

export async function addPublicSocialLink(platform: unknown, value: unknown, createId: () => string) {
  if (typeof platform !== "string" || !platformSet.has(platform)) throw new PublicSocialLinkError("សូមជ្រើសរើសបណ្ដាញសង្គមដែលត្រឹមត្រូវ។", 400);
  if (typeof value !== "string" || value.length > 2048) throw new PublicSocialLinkError("តំណភ្ជាប់មិនត្រឹមត្រូវទេ។", 400);
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new PublicSocialLinkError("សូមបញ្ចូល URL ពេញលេញដែលចាប់ផ្ដើមដោយ https://។", 400); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    throw new PublicSocialLinkError("តំណភ្ជាប់ត្រូវប្រើ HTTPS និងមិនអាចមានព័ត៌មានចូលគណនីបានទេ។", 400);
  }
  const links = await listPublicSocialLinks();
  if (links.length >= 12) throw new PublicSocialLinkError("អាចបន្ថែមតំណភ្ជាប់បានច្រើនបំផុត 12។", 409);
  const id = createId();
  await execute("INSERT INTO public_social_links (id,platform,url) VALUES (?,?,?)", [id, platform, url.toString()]);
  return { id, platform: platform as SocialPlatform, url: url.toString() };
}

export async function removePublicSocialLink(id: unknown) {
  if (typeof id !== "string" || id.length < 1 || id.length > 64) throw new PublicSocialLinkError("តំណភ្ជាប់ដែលស្នើសុំមិនត្រឹមត្រូវទេ។", 400);
  if (await execute("DELETE FROM public_social_links WHERE id=?", [id]) === 0) throw new PublicSocialLinkError("រកមិនឃើញតំណភ្ជាប់នេះទេ។", 404);
  return { id };
}
