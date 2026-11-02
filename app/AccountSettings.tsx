"use client";

import ControlButton from "./ControlButton";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Image from "next/image";
import type { AuthUser } from "./lib/auth";

import ThemePreferences from "./ThemePreferences";
import TradingRiskSettings from "./TradingRiskSettings";

async function readImage(file: File, maxBytes: number) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("សូមជ្រើសរើសរូបភាព PNG, JPEG ឬ WebP។");
  }
  if (file.size > maxBytes) throw new Error(`ទំហំរូបភាពមិនត្រូវលើស ${Math.round(maxBytes / 1024)} KB ទេ។`);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("មិនអាចអានរូបភាពបានទេ។ សូមជ្រើសរើសម្ដងទៀត។"));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("ទម្រង់រូបភាពមិនត្រឹមត្រូវទេ។"));
    };
    reader.readAsDataURL(file);
  });
}

export default function AccountSettings({
  user,
  onProfileUpdated,
}: {
  user: AuthUser;
  onProfileUpdated: (user: AuthUser) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName || user.email.split("@")[0]);
  const [avatarDataUrl, setAvatarDataUrl] = useState(user.avatarDataUrl || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const image = await readImage(file, 700 * 1024);
      setAvatarDataUrl(image);
      setProfileMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "មិនអាចប្រើរូបភាពនេះបានទេ។";
      setProfileMessage(message);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProfileMessage("");
    try {
      const payload: Record<string, string | null> = { displayName, avatarDataUrl: avatarDataUrl || null };
      if (currentPassword || newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "មិនអាចរក្សាទុកការកែប្រែបានទេ។");
      onProfileUpdated(result.user as AuthUser);
      setCurrentPassword("");
      setNewPassword("");
      setProfileMessage("បានរក្សាទុកព័ត៌មានគណនី។");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "មានបញ្ហាក្នុងការរក្សាទុក។ សូមសាកល្បងម្ដងទៀត។");
    } finally {
      setBusy(false);
    }
  }

  return <section className="account-settings" aria-label="ការកំណត់គណនី និងរូបរាង">
    <article className="settings-card profile-settings-card">
      <div className="settings-card-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h2>គណនី និង Profile</h2><p>កែឈ្មោះ រូប Profile និងព័ត៌មានចូលប្រើប្រាស់របស់អ្នក។</p></div></div>
      <form className="settings-profile-form" onSubmit={(event) => void saveProfile(event)}>
        <div className="profile-avatar-picker">
          {avatarDataUrl ? <Image src={avatarDataUrl} alt="រូប Profile បច្ចុប្បន្ន" width={66} height={66} unoptimized /> : <span aria-hidden="true">{displayName.trim().slice(0, 1).toUpperCase() || "U"}</span>}
          <label className="settings-secondary-button" data-ui-control="secondary" data-ui-size="md">ប្ដូររូប Profile<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseImage(event)} /></label>
          {avatarDataUrl && <ControlButton variant="ghost" type="button" className="settings-text-button" onClick={() => setAvatarDataUrl("")}>លុបរូប</ControlButton>}
        </div>
        <label className="settings-field">ឈ្មោះអ្នកប្រើប្រាស់<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={48} required autoComplete="nickname" /></label>
        <label className="settings-field">អ៊ីមែលគណនី<input value={user.email} readOnly /></label>
        <div className="settings-password-fields"><label className="settings-field">ពាក្យសម្ងាត់បច្ចុប្បន្ន<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></label><label className="settings-field">ពាក្យសម្ងាត់ថ្មី<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={72} autoComplete="new-password" placeholder="យ៉ាងតិច 12 តួអក្សរ" /></label></div>
        <p className="settings-hint">បើមិនចង់ប្ដូរពាក្យសម្ងាត់ សូមទុកប្រអប់ទាំងពីរឲ្យនៅទទេ។</p>
        {profileMessage && <p className="settings-feedback" role="status">{profileMessage}</p>}
        <ControlButton variant="primary" className="settings-primary-button" type="submit" disabled={busy}>{busy ? "កំពុងរក្សាទុក…" : "រក្សាទុកព័ត៌មានគណនី"}</ControlButton>
      </form>
    </article>

    <ThemePreferences />
    <TradingRiskSettings />

  </section>;
}
