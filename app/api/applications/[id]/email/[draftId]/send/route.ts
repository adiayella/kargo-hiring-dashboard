import { NextRequest, NextResponse } from "next/server";
import { db, eq } from "@/lib/db";
import { sendEmail, isResendConfigured } from "@/lib/resend";
import { logDecisionEvent } from "@/lib/audit";
import { resolveRecipient, applyTestSubjectPrefix, buildTestInfoBlock, isTestMode } from "@/lib/emailDelivery";

const OUTCOME_TO_STATUS: Record<string, string> = {
  strong_advance: "invited",
  advance: "invited",
  hold: "contacted",
  reject: "rejected",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold for review",
  do_not_advance: "Do not advance",
};

// The ONLY send endpoint. Whatever the browser sends as a "recipient" is
// ignored completely — resolveRecipient() decides the real destination
// server-side from EMAIL_DELIVERY_MODE / TEST_EMAIL_RECIPIENT. This is the
// enforcement point that guarantees a candidate can never receive mail while
// the app is in test mode, no matter what the client requests.
export async function POST(req: NextRequest, { params }: { params: { id: string; draftId: string } }) {
  const { id: applicationId, draftId } = params;

  if (!isResendConfigured()) {
    return NextResponse.json(
      { error: "Email sending is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL on the server." },
      { status: 503 }
    );
  }

  const requestBody = await req.json().catch(() => ({}));
  const { idempotencyKey, confirmedProfileReview, confirmedEmailReview } = requestBody as {
    idempotencyKey?: string;
    confirmedProfileReview?: boolean;
    confirmedEmailReview?: boolean;
  };

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    return NextResponse.json({ error: "idempotencyKey is required" }, { status: 400 });
  }
  if (confirmedProfileReview !== true || confirmedEmailReview !== true) {
    return NextResponse.json(
      { error: "Explicit confirmation that the profile and email were reviewed is required" },
      { status: 400 }
    );
  }

  const applications = await db.select<{
    id: string;
    candidate_name: string | null;
    email: string | null;
    final_recommendation: string | null;
    review_status: string;
  }>("applications", { id: eq(applicationId) });
  const application = applications[0];
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.review_status === "pending_review" || !application.final_recommendation) {
    return NextResponse.json({ error: "A final decision must be selected before sending" }, { status: 409 });
  }

  const drafts = await db.select<{
    id: string;
    email_subject: string;
    email_body: string;
    status: string;
    sent_at: string | null;
    email_outcome: string | null;
  }>("drafts", { id: eq(draftId) });
  const draft = drafts[0];
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (!draft.email_subject?.trim() || !draft.email_body?.trim()) {
    return NextResponse.json({ error: "Draft is missing a subject or body" }, { status: 400 });
  }
  if (draft.sent_at || draft.status === "sent") {
    return NextResponse.json({ error: "This draft has already been sent" }, { status: 409 });
  }

  // Idempotency: a retried request with the same key returns the prior result
  // instead of sending twice. A prior *failed* attempt with the same key is
  // cleared so the retry can proceed fresh.
  const existing = await db.select<{ id: string; resend_message_id: string | null; status: string }>("emails_log", {
    idempotency_key: eq(idempotencyKey),
  });
  if (existing[0]) {
    if (existing[0].status === "sent") {
      return NextResponse.json({ ok: true, messageId: existing[0].resend_message_id, deduped: true });
    }
    await db.raw("delete from emails_log where id = $1", [existing[0].id]);
  }

  let resolved;
  try {
    resolved = resolveRecipient(application.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delivery is not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const subject = applyTestSubjectPrefix(draft.email_subject, resolved.mode);
  const testInfo = isTestMode()
    ? buildTestInfoBlock({
        candidateName: application.candidate_name,
        candidateId: application.id,
        intendedEmail: resolved.intendedRecipient,
        recommendedDecision: RECOMMENDATION_LABELS[application.final_recommendation] ?? application.final_recommendation,
      })
    : "";
  const body = `${draft.email_body}${testInfo}`;

  try {
    const { messageId } = await sendEmail({ to: resolved.actualRecipient, subject, body });

    await db.insert("emails_log", {
      application_id: applicationId,
      recipient: resolved.actualRecipient,
      intended_recipient: resolved.intendedRecipient,
      subject,
      body,
      send_type: "drafted",
      idempotency_key: idempotencyKey,
      resend_message_id: messageId,
      status: "sent",
      delivery_mode: resolved.mode,
      is_test: resolved.mode === "test",
    });

    await db.update("drafts", { id: eq(draftId) }, { sent_at: new Date().toISOString(), status: "sent" });

    const nextStatus = OUTCOME_TO_STATUS[draft.email_outcome ?? ""] ?? "contacted";
    await db.update("applications", { id: eq(applicationId) }, {
      status: nextStatus,
      email_status: resolved.mode === "test" ? "sent_in_test_mode" : "sent",
    });

    await logDecisionEvent(applicationId, "email_sent", {
      draftId,
      messageId,
      deliveryMode: resolved.mode,
      actualRecipient: resolved.actualRecipient,
    });

    return NextResponse.json({ ok: true, messageId, actualRecipient: resolved.actualRecipient, mode: resolved.mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.insert("emails_log", {
      application_id: applicationId,
      recipient: resolved.actualRecipient,
      intended_recipient: resolved.intendedRecipient,
      subject,
      body,
      send_type: "drafted",
      idempotency_key: idempotencyKey,
      status: "failed",
      error_message: message,
      delivery_mode: resolved.mode,
      is_test: resolved.mode === "test",
    });
    await db.update("applications", { id: eq(applicationId) }, { email_status: "failed" });
    await logDecisionEvent(applicationId, "email_failed", { draftId, error: message });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
