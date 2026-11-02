"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminMember, AdminMemberAction } from "../../lib/admin-members";

type AuditEvent = {
  id: string;
  actorEmail: string;
  targetEmail: string;
  action: AdminMemberAction | "bootstrap_admin";
  occurredAt: string;
};
type Filter = "all" | "pending" | "approved" | "disabled" | "rejected";
type ResponseData = { members: AdminMember[]; audit: AuditEvent[]; error?: string };

async function fetchMembers() {
  const response = await fetch("/api/admin/members", { cache: "no-store" });
  const data = await response.json() as ResponseData;
  if (!response.ok) throw new Error(data.error || "មិនអាចទាញយកបញ្ជីសមាជិកបានទេ។");
  return data;
}

const actionLabels: Record<AuditEvent["action"], string> = {
  approve: "អនុម័តសមាជិក",
  reject: "បដិសេធសំណើ",
  disable: "បិទការចូល",
  enable: "បើកការចូលវិញ",
  bootstrap_admin: "បង្កើតអ្នកគ្រប់គ្រង",
};

function memberStatus(member: AdminMember) {
  if (member.status === "pending") return member.emailVerified ? "កំពុងរង់ចាំអនុម័ត" : "មិនទាន់ផ្ទៀងផ្ទាត់អ៊ីមែល";
  if (member.status === "rejected") return "បានបដិសេធ";
  return member.accessEnabled ? "បានបើក" : "បានបិទ";
}

export default function AdminMembers() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await fetchMembers();
      setMembers(data.members);
      setAudit(data.audit);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មានបញ្ហាក្នុងការទាញយកទិន្នន័យ។");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchMembers().then((data) => {
      if (!active) return;
      setMembers(data.members);
      setAudit(data.audit);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "មានបញ្ហាក្នុងការទាញយកទិន្នន័យ។");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filteredMembers = useMemo(() => members.filter((member) => {
    if (filter === "pending") return member.status === "pending";
    if (filter === "approved") return member.status === "approved" && member.accessEnabled;
    if (filter === "disabled") return member.status === "approved" && !member.accessEnabled;
    if (filter === "rejected") return member.status === "rejected";
    return true;
  }), [filter, members]);

  async function updateMember(member: AdminMember, action: AdminMemberAction) {
    const prompts: Partial<Record<AdminMemberAction, string>> = {
      reject: `តើអ្នកប្រាកដថាចង់បដិសេធសំណើរបស់ ${member.email} ឬទេ?`,
      disable: `តើអ្នកប្រាកដថាចង់បិទការចូលប្រើរបស់ ${member.email} ឬទេ? Session បច្ចុប្បន្ននឹងបាត់សិទ្ធិភ្លាមៗ។`,
    };
    if (prompts[action] && !window.confirm(prompts[action])) return;
    setBusyId(member.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id, action }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "មិនអាចធ្វើបច្ចុប្បន្នភាពគណនីបានទេ។");
      setMessage(`បានធ្វើបច្ចុប្បន្នភាពគណនី ${member.email}។`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មានបញ្ហាក្នុងការធ្វើបច្ចុប្បន្នភាព។");
    } finally {
      setBusyId("");
    }
  }

  return <div className="connections-content admin-members-content">
    <section className="connections-intro">
      <p className="connections-eyebrow">MEMBER ACCESS CONTROL</p>
      <h1>គ្រប់គ្រងសមាជិក</h1>
      <p>ពិនិត្យសំណើចុះឈ្មោះ និងបើក ឬបិទសិទ្ធិចូលប្រើប្រព័ន្ធ។ រាល់សកម្មភាពត្រូវបានកត់ត្រា។</p>
    </section>

    <section className="admin-members-panel" aria-labelledby="admin-members-heading">
      <div className="admin-members-toolbar">
        <div><p className="connections-eyebrow">MEMBER DIRECTORY</p><h2 id="admin-members-heading">បញ្ជីគណនី</h2></div>
        <button type="button" className="admin-refresh" onClick={() => { setLoading(true); setError(""); void refresh(); }} disabled={loading}>{loading ? "កំពុងផ្ទុក…" : "↻ ធ្វើបច្ចុប្បន្នភាព"}</button>
      </div>
      <div className="admin-member-filters" aria-label="ត្រងសមាជិក">
        {([
          ["all", "ទាំងអស់"],
          ["pending", "រង់ចាំ"],
          ["approved", "បានបើក"],
          ["disabled", "បានបិទ"],
          ["rejected", "បដិសេធ"],
        ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
      </div>
      {message && <p className="admin-feedback success" role="status">{message}</p>}
      {error && <p className="admin-feedback error" role="alert">{error}</p>}
      {loading && members.length === 0 ? <p className="admin-empty" role="status">កំពុងទាញយកបញ្ជីសមាជិក…</p>
        : filteredMembers.length === 0 ? <p className="admin-empty">មិនមានគណនីក្នុងស្ថានភាពនេះទេ។</p>
          : <div className="admin-member-table-wrap"><table className="admin-member-table">
            <thead><tr><th scope="col">គណនី</th><th scope="col">ស្ថានភាព</th><th scope="col">IP ពេលចុះឈ្មោះ</th><th scope="col">IP ចូលចុងក្រោយ</th><th scope="col">ថ្ងៃចុះឈ្មោះ</th><th scope="col">សកម្មភាព</th></tr></thead>
            <tbody>{filteredMembers.map((member) => <tr key={member.id}>
              <td><strong>{member.displayName || member.email.split("@")[0]}</strong><span>{member.email}</span></td>
              <td><span className={`admin-status ${member.status === "pending" ? "pending" : member.status === "rejected" || !member.accessEnabled ? "disabled" : "enabled"}`}>{memberStatus(member)}</span></td>
              <td><code>{member.registrationIp || <span aria-label="មិនមានទិន្នន័យ">—</span>}</code></td>
              <td><code>{member.lastLoginIp || <span aria-label="មិនមានទិន្នន័យ">—</span>}</code></td>
              <td><time dateTime={member.createdAt}>{member.createdAt}</time></td>
              <td><div className="admin-member-actions">
                {member.status === "pending" && <>
                  <button type="button" className="approve" onClick={() => void updateMember(member, "approve")} disabled={busyId === member.id || !member.emailVerified} title={!member.emailVerified ? "ត្រូវផ្ទៀងផ្ទាត់អ៊ីមែលជាមុនសិន" : undefined}>អនុម័ត</button>
                  <button type="button" className="reject" onClick={() => void updateMember(member, "reject")} disabled={busyId === member.id}>បដិសេធ</button>
                </>}
                {member.status === "approved" && member.accessEnabled && <button type="button" className="reject" onClick={() => void updateMember(member, "disable")} disabled={busyId === member.id}>បិទការចូល</button>}
                {member.status === "approved" && !member.accessEnabled && <button type="button" className="approve" onClick={() => void updateMember(member, "enable")} disabled={busyId === member.id}>បើកវិញ</button>}
                {busyId === member.id && <span className="admin-action-pending" role="status">កំពុងដំណើរការ…</span>}
              </div></td>
            </tr>)}</tbody>
          </table></div>}
      <p className="admin-member-count">បង្ហាញ {filteredMembers.length} ក្នុងចំណោម {members.length} គណនី</p>
    </section>

    <section className="admin-members-panel" aria-labelledby="admin-audit-heading">
      <div className="admin-members-toolbar"><div><p className="connections-eyebrow">SECURITY LOG</p><h2 id="admin-audit-heading">ប្រវត្តិសកម្មភាពអ្នកគ្រប់គ្រង</h2></div></div>
      {audit.length === 0 ? <p className="admin-empty">មិនទាន់មានសកម្មភាពទេ។</p>
        : <ol className="admin-audit-list">{audit.map((event) => <li key={event.id}>
          <span className="admin-audit-action">{actionLabels[event.action]}</span>
          <span><strong>{event.actorEmail}</strong> → {event.targetEmail}</span>
          <time dateTime={event.occurredAt}>{event.occurredAt}</time>
        </li>)}</ol>}
    </section>
  </div>;
}
