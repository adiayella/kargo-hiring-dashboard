import { NextRequest, NextResponse } from "next/server";
import { db, eq } from "@/lib/db";
import { sendEmail } from "@/lib/resend";

// Two ways to send, both explicit founder-triggered clicks:
// { sendType: "drafted", draftId, to, subject, body } — one-click send of a stored draft (editable before send)
// { sendType: "compose",           to, subject, body } — free-form compose to anyone tied to the application
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const applicationId = params.id;
  const body = await req.json();
  const { sendType, draftId, to, subject, body: emailBody } = body as {
    sendType: "drafted" | "compose";
    draftId?: string;
    to: string;
    subject: string;
    body: string;
  };

  if (!to || !subject || !emailBody || (sendType !== "drafted" && sendType !== "compose")) {
    return NextResponse.json({ error: "to, subject, body, and a valid sendType are required" }, { status: 400 });
  }

  try {
    await sendEmail({ to, subject, body: emailBody });

    await db.insert("emails_log", {
      application_id: applicationId,
      recipient: to,
      subject,
      body: emailBody,
      send_type: sendType,
    });

    let nextStatus: "invited" | "rejected" | "contacted" = "contacted";

    if (sendType === "drafted" && draftId) {
      const drafts = await db.update<{ draft_type: string }>(
        "drafts",
        { id: eq(draftId) },
        { sent_at: new Date().toISOString() }
      );
      if (drafts?.draft_type === "invite") nextStatus = "invited";
      else if (drafts?.draft_type === "reject") nextStatus = "rejected";
      else nextStatus = "contacted";
    }

    await db.update("applications", { id: eq(applicationId) }, { status: nextStatus });

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (err) {
    console.error("Send failed", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send email: ${message}` }, { status: 500 });
  }
}
