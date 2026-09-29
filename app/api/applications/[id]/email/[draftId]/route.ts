import { NextRequest, NextResponse } from "next/server";
import { db, eq } from "@/lib/db";

const MAX_SUBJECT = 300;
const MAX_BODY = 20000;

// Recruiter edits to a draft before sending. The recipient is never editable
// here — actual delivery is always resolved server-side from the application's
// email + the delivery-mode config (see lib/emailDelivery.ts), never from a
// client-supplied value, so there is nothing meaningful to edit on that front.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; draftId: string } }) {
  const { id: applicationId, draftId } = params;
  const body = await req.json().catch(() => ({}));
  const { subject, body: emailBody } = body as { subject?: string; body?: string };

  const patch: Record<string, unknown> = { recruiter_edited: true, status: "edited" };

  if (subject !== undefined) {
    if (typeof subject !== "string" || !subject.trim() || subject.length > MAX_SUBJECT) {
      return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
    }
    patch.email_subject = subject;
  }
  if (emailBody !== undefined) {
    if (typeof emailBody !== "string" || !emailBody.trim() || emailBody.length > MAX_BODY) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    patch.email_body = emailBody;
  }

  const draft = await db.update<{ id: string; status: string; sent_at: string | null }>("drafts", { id: eq(draftId) }, patch);
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (draft.sent_at) {
    return NextResponse.json({ error: "Cannot edit a draft that has already been sent" }, { status: 409 });
  }

  await db.update("applications", { id: eq(applicationId) }, { email_status: "edited" });

  return NextResponse.json({ draft });
}
