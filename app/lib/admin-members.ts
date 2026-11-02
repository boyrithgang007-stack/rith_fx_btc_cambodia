import type Database from "better-sqlite3";

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

export function initializeAdminMembers(db: Database.Database) {
  db.transaction(() => {
    const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!columns.some((column) => column.name === "role")) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin'))");
    }
    if (!columns.some((column) => column.name === "access_enabled")) {
      db.exec("ALTER TABLE users ADD COLUMN access_enabled INTEGER NOT NULL DEFAULT 1 CHECK(access_enabled IN (0,1))");
    }
    if (!columns.some((column) => column.name === "registration_ip")) {
      db.exec("ALTER TABLE users ADD COLUMN registration_ip TEXT");
    }
    if (!columns.some((column) => column.name === "last_login_ip")) {
      db.exec("ALTER TABLE users ADD COLUMN last_login_ip TEXT");
    }
    db.exec(`CREATE TABLE IF NOT EXISTS admin_audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      target_email TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('approve','reject','disable','enable','bootstrap_admin')),
      occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS admin_audit_events_occurred ON admin_audit_events(occurred_at DESC);`);
  }).immediate();
}

export function listAdminMembers(db: Database.Database): AdminMember[] {
  return db.prepare(`SELECT id, email, display_name AS displayName, status,
    email_verified AS emailVerified, access_enabled AS accessEnabled, created_at AS createdAt,
    registration_ip AS registrationIp, last_login_ip AS lastLoginIp
    FROM users WHERE role = 'member' ORDER BY created_at DESC, email COLLATE NOCASE`)
    .all()
    .map((row) => {
      const member = row as Omit<AdminMember, "accessEnabled" | "emailVerified"> & { accessEnabled: number; emailVerified: number };
      return { ...member, emailVerified: member.emailVerified === 1, accessEnabled: member.accessEnabled === 1 };
    });
}

export function listAdminAuditEvents(db: Database.Database) {
  return db.prepare(`SELECT id, actor_email AS actorEmail, target_email AS targetEmail,
    action, occurred_at AS occurredAt FROM admin_audit_events
    ORDER BY occurred_at DESC, id DESC LIMIT 100`).all() as {
      id: string;
      actorEmail: string;
      targetEmail: string;
      action: AdminMemberAction | "bootstrap_admin";
      occurredAt: string;
    }[];
}

export function updateAdminMember(
  db: Database.Database,
  actor: { id: string; email: string },
  targetId: unknown,
  action: unknown,
  createId: () => string,
) {
  if (typeof targetId !== "string" || targetId.length > 64
    || !["approve", "reject", "disable", "enable"].includes(String(action))) {
    throw new AdminMemberError("សំណើមិនត្រឹមត្រូវ។", 400);
  }

  return db.transaction(() => {
    const target = db.prepare("SELECT id, email, status, role, email_verified AS emailVerified, access_enabled AS accessEnabled FROM users WHERE id = ?")
      .get(targetId) as { id: string; email: string; status: string; role: string; emailVerified: number; accessEnabled: number } | undefined;
    if (!target) throw new AdminMemberError("រកមិនឃើញគណនីនេះទេ។", 404);
    if (target.role !== "member") throw new AdminMemberError("មិនអាចកែប្រែគណនីអ្នកគ្រប់គ្រងនៅទីនេះបានទេ។", 403);

    const next = String(action) as AdminMemberAction;
    if (next === "approve" && target.emailVerified !== 1) {
      throw new AdminMemberError("សមាជិកត្រូវផ្ទៀងផ្ទាត់អ៊ីមែលជាមុនសិន។", 409);
    }
    if ((next === "approve" || next === "reject") && target.status !== "pending") {
      throw new AdminMemberError("អាចពិនិត្យបានតែសំណើដែលកំពុងរង់ចាំប៉ុណ្ណោះ។", 409);
    }
    if (next === "disable" && (target.status !== "approved" || target.accessEnabled !== 1)) {
      throw new AdminMemberError("គណនីនេះមិនស្ថិតក្នុងស្ថានភាពអនុម័ត និងបើកដំណើរការទេ។", 409);
    }
    if (next === "enable" && (target.status !== "approved" || target.accessEnabled !== 0)) {
      throw new AdminMemberError("អាចបើកបានតែគណនីដែលបានអនុម័ត និងបិទប៉ុណ្ណោះ។", 409);
    }

    if (next === "approve") db.prepare("UPDATE users SET status = 'approved' WHERE id = ?").run(target.id);
    else if (next === "reject") db.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").run(target.id);
    else db.prepare("UPDATE users SET access_enabled = ? WHERE id = ?").run(next === "enable" ? 1 : 0, target.id);
    db.prepare(`INSERT INTO admin_audit_events
      (id, actor_user_id, actor_email, target_user_id, target_email, action)
      VALUES (?, ?, ?, ?, ?, ?)`).run(createId(), actor.id, actor.email, target.id, target.email, next);
    return { id: target.id, email: target.email, action: next };
  })();
}
