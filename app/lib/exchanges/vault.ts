import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class VaultConfigurationError extends Error {}

function key() {
  const value = process.env.EXCHANGE_ENCRYPTION_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new VaultConfigurationError("Configure EXCHANGE_ENCRYPTION_KEY with 32 random bytes encoded as hex.");
  return Buffer.from(value, "hex");
}

export function assertVaultConfigured() { key(); }

export function sealCredentials(value: unknown, owner: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}

export function openCredentials(value: string, owner: string): unknown {
  const [version, iv, tag, encrypted, extra] = value.split(":");
  if (version !== "v1" || extra || !/^[a-f0-9]{24}$/.test(iv ?? "") || !/^[a-f0-9]{32}$/.test(tag ?? "") || !/^(?:[a-f0-9]{2})+$/.test(encrypted ?? "")) throw new Error("Invalid encrypted credential record.");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  cipher.setAAD(Buffer.from(owner));
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(encrypted, "hex")), cipher.final()]).toString("utf8"));
}
