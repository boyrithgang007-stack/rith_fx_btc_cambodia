import type Database from "better-sqlite3";

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "x", "telegram", "website"] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
export type PublicSocialLink = { id: string; platform: SocialPlatform; url: string };

const platformSet = new Set<string>(SOCIAL_PLATFORMS);

export class PublicSocialLinkError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function initializePublicSocialLinks(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS public_social_links (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram','tiktok','youtube','x','telegram','website')),
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export function listPublicSocialLinks(db: Database.Database): PublicSocialLink[] {
  return db.prepare("SELECT id, platform, url FROM public_social_links ORDER BY created_at ASC, id ASC")
    .all() as PublicSocialLink[];
}

export function addPublicSocialLink(db: Database.Database, platform: unknown, value: unknown, createId: () => string) {
  if (typeof platform !== "string" || !platformSet.has(platform)) {
    throw new PublicSocialLinkError("សូមជ្រើសរើសបណ្ដាញសង្គមដែលត្រឹមត្រូវ។", 400);
  }
  if (typeof value !== "string" || value.length > 2048) {
    throw new PublicSocialLinkError("តំណភ្ជាប់មិនត្រឹមត្រូវទេ។", 400);
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new PublicSocialLinkError("សូមបញ្ចូល URL ពេញលេញដែលចាប់ផ្ដើមដោយ https://។", 400);
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    throw new PublicSocialLinkError("តំណភ្ជាប់ត្រូវប្រើ HTTPS និងមិនអាចមានព័ត៌មានចូលគណនីបានទេ។", 400);
  }
  if (listPublicSocialLinks(db).length >= 12) {
    throw new PublicSocialLinkError("អាចបន្ថែមតំណភ្ជាប់បានច្រើនបំផុត 12។", 409);
  }

  const id = createId();
  db.prepare("INSERT INTO public_social_links (id, platform, url) VALUES (?, ?, ?)")
    .run(id, platform, url.toString());
  return { id, platform: platform as SocialPlatform, url: url.toString() };
}

export function removePublicSocialLink(db: Database.Database, id: unknown) {
  if (typeof id !== "string" || id.length < 1 || id.length > 64) {
    throw new PublicSocialLinkError("តំណភ្ជាប់ដែលស្នើសុំមិនត្រឹមត្រូវទេ។", 400);
  }
  const result = db.prepare("DELETE FROM public_social_links WHERE id = ?").run(id);
  if (result.changes === 0) throw new PublicSocialLinkError("រកមិនឃើញតំណភ្ជាប់នេះទេ។", 404);
  return { id };
}
