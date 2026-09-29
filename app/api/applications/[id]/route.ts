import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { db, eq } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const [applications, scores, drafts, emails, evaluations, decisionEvents, candidates] = await Promise.all([
    db.select("applications", { id: eq(id) }),
    db.select("scores", { application_id: eq(id), order: "created_at.asc" }),
    db.select("drafts", { application_id: eq(id), order: "created_at.desc" }),
    db.select("emails_log", { application_id: eq(id), order: "sent_at.desc" }),
    db.select("evaluations", { application_id: eq(id), order: "created_at.desc" }),
    db.select("decision_events", { application_id: eq(id), order: "created_at.asc" }),
    // This candidate's own extracted resume text — used only for this candidate's
    // own preview/evaluation, scoped strictly by application_id. Never combined
    // with another candidate's record.
    db.select("candidates", { application_id: eq(id) }),
  ]);

  const application = applications[0];
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const evaluation = evaluations[0] ?? null;
  const criteria = evaluation
    ? await db.select("evaluation_criteria", { evaluation_id: eq(evaluation.id), order: "created_at.asc" })
    : [];

  return NextResponse.json({
    application,
    scores,
    drafts,
    emails,
    evaluation,
    criteria,
    timeline: decisionEvents,
    candidate: candidates[0] ?? null,
  });
}

// Safe delete: requires an explicit confirmation token in the body so this can
// never be triggered by an accidental DELETE call — deletes the application
// (cascading to every related row via FK) and best-effort removes the stored
// resume file. Intended for cleaning up test candidates.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json().catch(() => ({}));
  const { confirm } = body as { confirm?: string };

  if (confirm !== "DELETE") {
    return NextResponse.json({ error: 'Deletion requires { "confirm": "DELETE" } in the request body' }, { status: 400 });
  }

  const applications = await db.select<{ id: string; file_url: string }>("applications", { id: eq(id) });
  const application = applications[0];
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (application.file_url?.startsWith("/uploads/")) {
    try {
      await unlink(path.join(process.cwd(), "public", application.file_url));
    } catch {
      // Best-effort — a missing file shouldn't block deleting the record.
    }
  } else if (application.file_url?.includes("blob.vercel-storage.com")) {
    try {
      const { del } = await import("@vercel/blob");
      await del(application.file_url);
    } catch {
      // Best-effort cleanup only.
    }
  }

  await db.raw("delete from applications where id = $1", [id]);

  return NextResponse.json({ ok: true });
}
