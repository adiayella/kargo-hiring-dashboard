import { NextRequest, NextResponse } from "next/server";
import { db, eq } from "@/lib/db";
import { generateCandidateEmail, type HoldSubtype } from "@/lib/ai";
import { logDecisionEvent } from "@/lib/audit";
import type { EmailOutcome, ReasonDetailLevel } from "@/lib/types";

const RECOMMENDATION_TO_OUTCOME: Record<string, EmailOutcome> = {
  strong_advance: "strong_advance",
  advance: "advance",
  hold: "hold",
  do_not_advance: "reject",
};

const VALID_TONES = ["warm_professional", "formal", "friendly_concise"];
const VALID_REASON_LEVELS: ReasonDetailLevel[] = ["none", "brief", "custom"];
const VALID_HOLD_SUBTYPES: HoldSubtype[] = ["request_info", "neutral_update"];

// Generates (or regenerates) a candidate email draft from the recruiter's
// approved/overridden decision — never from the raw AI recommendation alone.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const applicationId = params.id;
  const body = await req.json().catch(() => ({}));
  const {
    tone = "warm_professional",
    reasonDetailLevel = "brief",
    customReason,
    holdSubtype = "neutral_update",
  } = body as { tone?: string; reasonDetailLevel?: ReasonDetailLevel; customReason?: string; holdSubtype?: HoldSubtype };

  if (!VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Invalid tone" }, { status: 400 });
  }
  if (!VALID_REASON_LEVELS.includes(reasonDetailLevel)) {
    return NextResponse.json({ error: "Invalid reasonDetailLevel" }, { status: 400 });
  }
  if (!VALID_HOLD_SUBTYPES.includes(holdSubtype)) {
    return NextResponse.json({ error: "Invalid holdSubtype" }, { status: 400 });
  }
  if (reasonDetailLevel === "custom" && (!customReason || !customReason.trim())) {
    return NextResponse.json({ error: "customReason is required when reasonDetailLevel is 'custom'" }, { status: 400 });
  }

  const applications = await db.select<{
    id: string;
    candidate_name: string | null;
    email: string | null;
    role: "PM" | "SPM";
    review_status: string;
    final_recommendation: string | null;
  }>("applications", { id: eq(applicationId) });
  const application = applications[0];
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (application.review_status === "pending_review" || !application.final_recommendation) {
    return NextResponse.json(
      { error: "A recruiter must select a final decision before an email can be drafted" },
      { status: 409 }
    );
  }

  const evaluations = await db.select<{ id: string; strongest_matches: string[]; material_gaps: string[] }>(
    "evaluations",
    { application_id: eq(applicationId), order: "created_at.desc" }
  );
  const evaluation = evaluations[0];

  const outcome = RECOMMENDATION_TO_OUTCOME[application.final_recommendation];

  try {
    const generated = await generateCandidateEmail({
      candidateName: application.candidate_name,
      role: application.role,
      outcome,
      tone,
      reasonDetailLevel,
      customReason,
      holdSubtype: outcome === "hold" ? holdSubtype : undefined,
      strongestMatches: evaluation?.strongest_matches ?? [],
      materialGaps: evaluation?.material_gaps ?? [],
      candidateFacingReason: "",
    });

    const draft = await db.insert<Record<string, unknown>>("drafts", {
      application_id: applicationId,
      brief_text: "",
      email_subject: generated.subject,
      email_body: generated.body,
      draft_type: outcome === "reject" ? "reject" : outcome === "hold" ? "hold" : "invite",
      email_outcome: outcome,
      recipient: application.email,
      tone,
      reason_detail_level: reasonDetailLevel,
      hold_subtype: outcome === "hold" ? holdSubtype : null,
      status: "draft_generated",
      ai_generated: true,
      recruiter_edited: false,
    });

    await logDecisionEvent(applicationId, "email_drafted", { draftId: draft.id, outcome, tone, reasonDetailLevel, holdSubtype });
    await db.update("applications", { id: eq(applicationId) }, { email_status: "draft_generated" });

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("Email draft generation failed for application", applicationId, "-", err instanceof Error ? err.message : err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate email draft: ${message}` }, { status: 500 });
  }
}
