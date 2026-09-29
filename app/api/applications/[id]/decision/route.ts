import { NextRequest, NextResponse } from "next/server";
import { db, eq } from "@/lib/db";
import { logDecisionEvent } from "@/lib/audit";

const VALID_RECOMMENDATIONS = ["strong_advance", "advance", "hold", "do_not_advance"];

// Recruiter approves the AI recommendation as-is, or overrides it with a
// different final recommendation. Either way this is the human decision point
// required before any email can be sent — nothing downstream is automatic.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const applicationId = params.id;
  const body = await req.json().catch(() => ({}));
  const { finalRecommendation, reviewer } = body as { finalRecommendation?: string; reviewer?: string };

  if (!finalRecommendation || !VALID_RECOMMENDATIONS.includes(finalRecommendation)) {
    return NextResponse.json({ error: "finalRecommendation must be one of: " + VALID_RECOMMENDATIONS.join(", ") }, { status: 400 });
  }

  const applications = await db.select<{ ai_recommendation: string | null }>("applications", { id: eq(applicationId) });
  const application = applications[0];
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const overridden = application.ai_recommendation !== finalRecommendation;

  const updated = await db.update("applications", { id: eq(applicationId) }, {
    final_recommendation: finalRecommendation,
    recommendation_overridden: overridden,
    review_status: overridden ? "overridden" : "approved",
    reviewed_at: new Date().toISOString(),
    reviewer: typeof reviewer === "string" && reviewer.trim() ? reviewer.trim().slice(0, 200) : null,
  });

  await logDecisionEvent(applicationId, "recruiter_reviewed", {
    finalRecommendation,
    overridden,
    aiRecommendation: application.ai_recommendation,
  });

  return NextResponse.json({ application: updated });
}
