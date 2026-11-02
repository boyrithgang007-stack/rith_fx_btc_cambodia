import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { approvalMailConfig } from "./approval-mail";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || "rithbtccambodia@gmail.com";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
}

export async function sendSupportMessage(sender: string, message: string) {
  const config = approvalMailConfig();
  if (!validEmail(SUPPORT_EMAIL)) throw new Error("Support email is invalid.");

  const email = {
    from: config.from,
    to: [SUPPORT_EMAIL],
    replyTo: sender,
    subject: `RITH FX BTC support request from ${sender}`,
    text: `Support request from: ${sender}\nReceived: ${new Date().toISOString()}\n\n${message}`,
  };

  if (config.provider === "gmail") {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: config.gmailUser, pass: config.gmailPassword },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail(email);
      if (!result.accepted?.some(address => String(address).toLowerCase() === SUPPORT_EMAIL.toLowerCase())) {
        throw new Error("Support email was not accepted.");
      }
    } finally {
      transport.close();
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `support/${randomUUID()}`,
    },
    body: JSON.stringify({
      from: email.from,
      to: email.to,
      reply_to: sender,
      subject: email.subject,
      text: email.text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Support email provider rejected the request.");
}
