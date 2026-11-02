import {
  allowAuthAttempt,
  getCurrentUser,
  getUserByEmail,
  hashPassword,
  passwordIsValid,
  updateUserProfile,
  verifyPassword,
} from "@/app/lib/auth";
import { authJson, isSameOriginRequest, readLimitedJson } from "@/app/lib/auth-http";

export const runtime = "nodejs";

const MAX_PROFILE_BODY_BYTES = 1024 * 1024;
const MAX_AVATAR_BYTES = 700 * 1024;

function validAvatar(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > MAX_AVATAR_BYTES * 1.4) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) return false;
  if (match[1] === "png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (match[1] === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return authJson("សំណើមិនត្រូវបានអនុញ្ញាតទេ។", 403);
  const user = await getCurrentUser();
  if (!user) return authJson("សូមចូលគណនីម្ដងទៀត។", 401);
  if (!allowAuthAttempt(`profile:${user.id}`, 10, 15 * 60 * 1000)) {
    return authJson("ការកែប្រែគណនីញឹកញាប់ពេក។ សូមសាកល្បងម្ដងទៀតពេលក្រោយ។", 429);
  }

  const body = await readLimitedJson(request, MAX_PROFILE_BODY_BYTES);
  if (!body) return authJson("ទិន្នន័យមិនត្រឹមត្រូវ ឬឯកសាររូបភាពធំពេក។", 400);
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!displayName || displayName.length > 48 || /[\u0000-\u001f\u007f]/.test(displayName)) {
    return authJson("ឈ្មោះត្រូវមានពី 1 ដល់ 48 តួអក្សរ។", 400);
  }
  if (!validAvatar(body.avatarDataUrl)) {
    return authJson("សូមជ្រើសរើសរូប Profile PNG, JPEG ឬ WebP ដែលមានទំហំមិនលើស 700 KB។", 400);
  }

  let passwordHash: string | undefined;
  if (body.currentPassword !== undefined || body.newPassword !== undefined) {
    if (typeof body.currentPassword !== "string" || body.currentPassword.length > 72 || !passwordIsValid(body.newPassword)) {
      return authJson("សូមបញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្ន និងពាក្យសម្ងាត់ថ្មីយ៉ាងតិច 12 តួអក្សរ។", 400);
    }
    const account = await getUserByEmail(user.email);
    if (!account || !(await verifyPassword(body.currentPassword, account.password_hash))) {
      return authJson("ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវទេ។", 401);
    }
    passwordHash = await hashPassword(body.newPassword);
  }

  try {
    const updated = await updateUserProfile(user.id, displayName, body.avatarDataUrl, passwordHash);
    if (!updated) return authJson("រកមិនឃើញគណនីសម្រាប់ធ្វើបច្ចុប្បន្នភាពទេ។", 404);
    return Response.json({ user: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return authJson("មិនអាចរក្សាទុកការកែប្រែគណនីបានទេ។ សូមសាកល្បងម្ដងទៀត។", 500);
  }
}
