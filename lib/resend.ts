import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_REGEX.test(value);
}

// Never throws on missing config — callers use this to show a safe warning
// in the UI instead of a stack trace. Never logs or returns the key itself.
export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmail(params: { to: string; subject: string; body: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Email sending is not configured on the server");
  }
  if (!isValidEmail(params.to)) {
    throw new Error("Recipient email address is invalid");
  }
  if (!params.subject.trim() || !params.body.trim()) {
    throw new Error("Subject and body are required");
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    text: params.body,
  });

  if (error) {
    // `error` may carry provider-internal detail; surface only a safe message.
    throw new Error(`Email delivery failed: ${error.message ?? "unknown error"}`);
  }
  return { messageId: data?.id ?? null };
}
