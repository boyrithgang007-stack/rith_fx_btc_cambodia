"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import type { PublicSocialLink, SocialPlatform } from "./lib/public-social-links";

const platforms: { value: SocialPlatform; label: string; mark: string }[] = [
  { value: "facebook", label: "Facebook", mark: "f" },
  { value: "instagram", label: "Instagram", mark: "ig" },
  { value: "tiktok", label: "TikTok", mark: "♪" },
  { value: "youtube", label: "YouTube", mark: "▶" },
  { value: "x", label: "X", mark: "𝕏" },
  { value: "telegram", label: "Telegram", mark: "↗" },
  { value: "website", label: "Website", mark: "↗" },
];

type Props = { isAdmin: boolean; language: "km" | "en" };

export default function PublicSocialLinks({ isAdmin, language }: Props) {
  const [links, setLinks] = useState<PublicSocialLink[]>([]);
  const [platform, setPlatform] = useState<SocialPlatform>("facebook");
  const [url, setUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const km = language === "km";

  useEffect(() => {
    let active = true;
    fetch("/api/public-social-links", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { links?: PublicSocialLink[]; error?: string };
        if (!response.ok) throw new Error(data.error || "មិនអាចទាញយក Link បានទេ។");
        if (active) setLinks(data.links ?? []);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "មិនអាចទាញយក Link បានទេ។");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/public-social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, url }),
      });
      const data = await response.json() as { link?: PublicSocialLink; error?: string };
      if (!response.ok || !data.link) throw new Error(data.error || "មិនអាចបន្ថែម Link បានទេ។");
      setLinks((current) => [...current, data.link!]);
      setUrl("");
      setMessage(km ? "បានបន្ថែម Link ដោយជោគជ័យ។" : "Social link added.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចបន្ថែម Link បានទេ។");
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(id: string) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/public-social-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "មិនអាចលុប Link បានទេ។");
      setLinks((current) => current.filter((link) => link.id !== id));
      setMessage(km ? "បានលុប Link។" : "Social link removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "មិនអាចលុប Link បានទេ។");
    } finally {
      setBusyId("");
    }
  }

  return <section className="welcome-social-area" aria-label={km ? "បណ្ដាញសង្គមរបស់ក្រុម" : "Team social media"}>
    <div className="welcome-social-heading">
      <span>{km ? "បណ្ដាញសង្គម" : "SOCIAL LINKS"}</span>
      {isAdmin && <button type="button" className="welcome-social-manage" onClick={() => { setEditing((current) => !current); setError(""); setMessage(""); }}>
        {editing ? (km ? "បិទ" : "Done") : (km ? "＋ បន្ថែម Link" : "＋ Add link")}
      </button>}
    </div>
    {links.length > 0 && <div className="welcome-social-list">
      {links.map((link) => {
        const item = platforms.find(({ value }) => value === link.platform)!;
        return <div className="welcome-social-item" key={link.id}>
          <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.label} ↗`}>
            <span aria-hidden="true">{item.mark}</span>{item.label}<span className="welcome-social-arrow" aria-hidden="true">↗</span>
          </a>
          {isAdmin && editing && <button type="button" className="welcome-social-remove" aria-label={`${item.label} ${km ? "លុប Link" : "remove link"}`} disabled={busyId === link.id} onClick={() => void removeLink(link.id)}>×</button>}
        </div>;
      })}
    </div>}
    {!loading && links.length === 0 && !editing && <p className="welcome-social-empty">{km ? "មិនទាន់មាន Link បណ្ដាញសង្គមទេ។" : "No social links added yet."}</p>}
    {editing && isAdmin && <form className="welcome-social-form" onSubmit={(event) => void addLink(event)}>
      <label>{km ? "បណ្ដាញសង្គម" : "Platform"}
        <select value={platform} onChange={(event) => setPlatform(event.target.value as SocialPlatform)}>
          {platforms.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <label>{km ? "URL (HTTPS)" : "URL (HTTPS)"}
        <input type="url" required maxLength={2048} placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <button type="submit" disabled={busy || links.length >= 12}>{busy ? (km ? "កំពុងរក្សាទុក…" : "Saving…") : (km ? "រក្សាទុក Link" : "Save link")}</button>
    </form>}
    {error && <p className="welcome-social-feedback is-error" role="alert">{error}</p>}
    {message && <p className="welcome-social-feedback" role="status">{message}</p>}
  </section>;
}

export function AdministratorAvatar({ src }: { src?: string | null }) {
  return <Image className="welcome-team-photo" src={src || "/images/rith-profile.jpeg"} alt="ម៉ៅសុវណ្ណារិទ្ធ" width={48} height={48} />;
}
