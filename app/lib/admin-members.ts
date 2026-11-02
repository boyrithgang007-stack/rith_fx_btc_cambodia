import { execute, query, transaction } from "./database";

export type AdminMemberAction = "approve" | "reject" | "disable" | "enable";
export type AdminMember = {
  id: string;
  email: string;
  displayName: string | null;
  status: "pending" | "approved" | "rejected";
  emailVerified: boolean;
  accessEnabled: boolean;
  createdAt: string;
  registrationIp: string | null;
  lastLoginIp: string | null;
};

export class AdminMemberError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function listAdminMembers(): Promise<AdminMember[]> {
  const rows = await query<Omit<AdminMember, "accessEnabled" | "emailVerified"> & { accessEnabled: number; emailVerified: number }>(`SELECT id, email,
    display_name AS displayName, status, email_verified AS emailVerified, access_enabled AS accessEnabled,
    created_at AS createdAt, registration_ip AS registrationIp, last_login_ip AS lastLoginIp
    FROM users WHERE role='member' ORDER BY created_at DESC, lower(email)`);
  return rows.map(row => ({ ...row, emailVerified: row.emailVerified === 1, accessEnabled: row.accessEnabled === 1 }));
}

export function listAdminAuditEvents() {
  return query<{ id: string; actorEmail: string; targetEmail: string; action: AdminMemberAction | "bootstrap_admin"; occurredAt: string }>(`SELECT id,
    actor_email AS actorEmail, target_email AS targetEmail, action, occurred_at AS occurredAt
    FROM admin_audit_events ORDER BY occurred_at DESC, id DESC LIMIT 100`);
}

export async function updateAdminMember(
  actor: { id: string; email: string }, targetId: unknown, action: unknown, createId: () => string,
) {
  if (typeof targetId !== "string" || targetId.length > 64
    || !["approve", "reject", "disable", "enable"].includes(String(action))) {
    throw new AdminMemberError("សំណើមិនត្រឹមត្រូវ។", 400);
  }
  return transaction(async client => {
    const rows = await query<{ id: string; email: string; status: string; role: string; emailVerified: number; accessEnabled: number }>(
      "SELECT id,email,status,role,email_verified AS emailVerified,access_enabled AS accessEnabled FROM users WHERE id=? FOR UPDATE",
      [targetId], client,
    );
    const target = rows[0];
    if (!target) throw new AdminMemberError("រកមិនឃើញគណនីនេះទេ។", 404);
    if (target.role !== "member") throw new AdminMemberError("មិនអាចកែប្រែគណនីអ្នកគ្រប់គ្រងនៅទីនេះបានទេ។", 403);

    const next = String(action) as AdminMemberAction;
    if (next === "approve" && target.emailVerified !== 1) throw new AdminMemberError("សមាជិកត្រូវផ្ទៀងផ្ទាត់អ៊ីមែលជាមុនសិន។", 409);
    if ((next === "approve" || next === "reject") && target.status !== "pending") throw new AdminMemberError("អាចពិនិត្យបានតែសំណើដែលកំពុងរង់ចាំប៉ុណ្ណោះ។", 409);
    if (next === "disable" && (target.status !== "approved" || target.accessEnabled !== 1)) throw new AdminMemberError("គណនីនេះមិនស្ថិតក្នុងស្ថានភាពអនុម័ត និងបើកដំណើរការទេ។", 409);
    if (next === "enable" && (target.status !== "approved" || target.accessEnabled !== 0)) throw new AdminMemberError("អាចបើកបានតែគណនីដែលបានអនុម័ត និងបិទប៉ុណ្ណោះ។", 409);

    if (next === "approve") await execute("UPDATE users SET status='approved' WHERE id=?", [target.id], client);
    else if (next === "reject") await execute("UPDATE users SET status='rejected' WHERE id=?", [target.id], client);
    else await execute("UPDATE users SET access_enabled=? WHERE id=?", [next === "enable" ? 1 : 0, target.id], client);
    await execute(`INSERT INTO admin_audit_events (id,actor_user_id,actor_email,target_user_id,target_email,action)
      VALUES (?,?,?,?,?,?)`, [createId(), actor.id, actor.email, target.id, target.email, next], client);
    return { id: target.id, email: target.email, action: next };
  });
}
