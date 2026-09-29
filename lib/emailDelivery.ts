// Single server-side authority for where email actually goes. Every send path
// MUST route through resolveRecipient() — never trust a recipient value that
// came from the browser. This is the enforcement point for test mode.

export type DeliveryMode = "test" | "production";

export function getDeliveryMode(): DeliveryMode {
  // Defaults to "test" (the safe choice) for anything other than an explicit,
  // deliberate "production" value — a missing/misconfigured env var must never
  // silently enable real candidate delivery.
  return process.env.EMAIL_DELIVERY_MODE === "production" ? "production" : "test";
}

export function isTestMode() {
  return getDeliveryMode() === "test";
}

function getTestRecipient(): string {
  const recipient = process.env.TEST_EMAIL_RECIPIENT;
  if (!recipient || !recipient.trim()) {
    throw new Error("TEST_EMAIL_RECIPIENT is not configured on the server");
  }
  return recipient.trim();
}

export interface ResolvedRecipient {
  actualRecipient: string;
  intendedRecipient: string | null;
  mode: DeliveryMode;
}

// candidateEmail is the ONLY candidate-derived input this function reads —
// anything else the client sends (a "recipient" field, a "mode" flag) is
// ignored entirely. In test mode the real address never leaves this function.
export function resolveRecipient(candidateEmail: string | null): ResolvedRecipient {
  const mode = getDeliveryMode();
  if (mode === "test") {
    return { actualRecipient: getTestRecipient(), intendedRecipient: candidateEmail, mode };
  }
  if (!candidateEmail) {
    throw new Error("Candidate has no email on file — cannot send in production mode");
  }
  return { actualRecipient: candidateEmail, intendedRecipient: candidateEmail, mode };
}

export function applyTestSubjectPrefix(subject: string, mode: DeliveryMode): string {
  if (mode !== "test") return subject;
  return subject.startsWith("[TEST]") ? subject : `[TEST] ${subject}`;
}

export function buildTestInfoBlock(params: {
  candidateName: string | null;
  candidateId: string;
  intendedEmail: string | null;
  recommendedDecision: string;
}): string {
  return [
    "",
    "",
    "---",
    "[TEST MODE NOTICE]",
    "This is a test email. It was NOT delivered to the candidate.",
    `Candidate: ${params.candidateName ?? "Unknown"}`,
    `Candidate ID: ${params.candidateId}`,
    `Intended candidate email: ${params.intendedEmail ?? "not on file"}`,
    `Recommended decision: ${params.recommendedDecision}`,
    "---",
  ].join("\n");
}
