import { randomUUID } from "node:crypto";
import { allowAuthAttempt, getCurrentUser } from "@/app/lib/auth";
import {
  addPublicSocialLink,
  listPublicSocialLinks,
  PublicSocialLinkError,
  removePublicSocialLink,
} from "@/app/lib/public-social-links";
import { authJson, isSameOriginRequest, readAuthJson } from "@/app/lib/auth-http";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { response: authJson("សូមចូលគណនីអ្នកគ្រប់គ្រងជាមុន។", 401) } as const;
  if (user.role !== "admin") return { response: authJson("មុខងារនេះសម្រាប់តែអ្នកគ្រប់គ្រងប៉ុណ្ណោះ។", 403) } as const;
  if (!allowAuthAttempt(`social-links:${user.id}`, 60, 15 * 60 * 1000)) {
    return { response: authJson("សំណើច្រើនពេក។ សូមរង់ចាំបន្តិច។", 429) } as const;
  }
  return { user } as const;
}

export async function GET() {
  return Response.json({ links: await listPublicSocialLinks() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const body = await readAuthJson(request);
  if (!body) return authJson("ទិន្នន័យសំណើមិនត្រឹមត្រូវទេ។", 400);
  try {
    const link = await addPublicSocialLink(body.platform, body.url, randomUUID);
    return Response.json({ link }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PublicSocialLinkError) return authJson(error.message, error.status);
    console.error("Public social link creation failed", error);
    return authJson("មិនអាចបន្ថែមតំណភ្ជាប់បានទេ។", 500);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  const body = await readAuthJson(request);
  if (!body) return authJson("ទិន្នន័យសំណើមិនត្រឹមត្រូវទេ។", 400);
  try {
    const result = await removePublicSocialLink(body.id);
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PublicSocialLinkError) return authJson(error.message, error.status);
    console.error("Public social link removal failed", error);
    return authJson("មិនអាចលុបតំណភ្ជាប់បានទេ។", 500);
  }
}
