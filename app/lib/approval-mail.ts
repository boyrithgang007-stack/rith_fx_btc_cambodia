import nodemailer from "nodemailer";

export class ApprovalMailConfigurationError extends Error {}

export function approvalMailConfig() {
  const provider = process.env.APPROVAL_MAIL_PROVIDER?.trim() || "resend";
  if (!["gmail", "resend"].includes(provider)) throw new ApprovalMailConfigurationError("Invalid approval mail provider.");
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = provider === "gmail" ? gmailUser : process.env.APPROVAL_EMAIL_FROM?.trim();
  const to = process.env.APPROVAL_ADMIN_EMAIL?.trim();
  const origin = process.env.APP_BASE_URL?.trim();
  if ((provider === "resend" && !apiKey) || !from || !to || !origin || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || /[\r\n]/.test(from)) {
    throw new ApprovalMailConfigurationError("Approval email settings are incomplete.");
  }
  if (provider === "gmail" && (!gmailUser || !/^[^\s@]+@gmail\.com$/i.test(gmailUser) || !gmailPassword || !/^[a-zA-Z]{16}$/.test(gmailPassword))) {
    throw new ApprovalMailConfigurationError("Gmail address and 16-character App Password are required.");
  }
  let url: URL;
  try { url = new URL(origin); } catch { throw new ApprovalMailConfigurationError("Invalid APP_BASE_URL."); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new ApprovalMailConfigurationError("APP_BASE_URL must be an HTTPS origin (localhost HTTP allowed in development).");
  }
  return { provider, apiKey, from, to, origin: url.origin, gmailUser, gmailPassword };
}

async function sendEmail(message: { from: string; to: string[]; subject: string; text: string }, idempotencyKey: string) {
  const config = approvalMailConfig();
  if (config.provider === "gmail") {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: config.gmailUser, pass: config.gmailPassword },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail(message);
      if (!result.accepted?.some(address => message.to.some(recipient => String(address).toLowerCase() === recipient.toLowerCase()))) {
        throw new Error("Email was not accepted.");
      }
    } catch {
      throw new Error("Gmail could not send the email.");
    } finally {
      transport.close();
    }
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Email provider rejected the request.");
}

export async function sendApprovalEmail(email: string, token: string, requestId: string) {
  const config = approvalMailConfig();
  const url = `${config.origin}/membership-review#${token}`;
  const message = {
    from: config.from,
    to: [config.to],
    subject: "Edikiter — New membership approval request",
    text: `A new account is waiting for your approval.\n\nApplicant: ${email}\n\nReview and choose Approve or Reject:\n${url}\n\nThis private link expires in 72 hours and can be used once. Opening it does not approve the account. Do not forward it: anyone holding this link can decide this request. The applicant cannot sign in before approval.`,
  };
  try {
    await sendEmail(message, `membership/${requestId}`);
  } catch {
    throw new Error("Approval email could not be sent.");
  }
}

export async function sendEmailVerificationEmail(email: string, token: string, requestId: string) {
  const config = approvalMailConfig();
  const url = `${config.origin}/verify-email#${token}`;
  const message = {
    from: config.from,
    to: [email],
    subject: "RFX BTC TEAM Cambodia — Verify your email",
    text: `Confirm that you own this email address to continue your membership request:\n${url}\n\nThis private link expires in 24 hours and can be used once. If you did not request an account, you can ignore this message.`,
  };
  try {
    await sendEmail(message, `email-verification/${requestId}`);
  } catch {
    throw new Error("Verification email could not be sent.");
  }
}
