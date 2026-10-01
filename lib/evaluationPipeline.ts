import { db, eq } from "./db";
import { logDecisionEvent } from "./audit";
import { runStructuredEvaluation, validateAndNormalizeEvaluation } from "./ai";
import { RUBRIC_VERSION } from "./rubric";
import type { AnonymizedExperience } from "./types";

export async function runEvaluationPipeline(params: {
  applicationId: string;
  role: "PM" | "SPM";
  experience: AnonymizedExperience;
}) {
  // A truncated/malformed generation is treated as a failure by
  // validateAndNormalizeEvaluation() rather than silently persisted as a
  // false "no evidence anywhere" result — retry once before giving up,
  // since this appears to be an intermittent generation issue, not systemic.
  let evaluation;
  try {
    const raw = await runStructuredEvaluation(params.experience, params.role);
    evaluation = validateAndNormalizeEvaluation(raw);
  } catch (err) {
    console.error("First evaluation attempt failed, retrying once:", err instanceof Error ? err.message : err);
    const raw = await runStructuredEvaluation(params.experience, params.role);
    evaluation = validateAndNormalizeEvaluation(raw);
  }

  const evaluationRow = await db.insert<{ id: string }>("evaluations", {
    application_id: params.applicationId,
    rubric_version: RUBRIC_VERSION,
    candidate_summary: evaluation.candidateSummary,
    must_have_gates: evaluation.mustHaveGates,
    gates_requiring_validation: evaluation.gatesRequiringValidation,
    strongest_matches: evaluation.strongestMatches,
    transferable_experience: evaluation.transferableExperience,
    material_gaps: evaluation.materialGaps,
    risk_factors: evaluation.riskFactors,
    internal_reasoning: evaluation.internalReasoning,
    candidate_facing_reason: evaluation.candidateFacingReason,
    recommended_role: evaluation.recommendedRole,
    overall_score: evaluation.overallScore,
    ai_recommendation: evaluation.aiRecommendation,
    ai_confidence: evaluation.aiConfidence,
  });

  await db.insertMany(
    "evaluation_criteria",
    evaluation.criteria.map((c) => ({
      evaluation_id: evaluationRow.id,
      criterion: c.name,
      weight: c.weight,
      score: c.score,
      weighted_score: c.weightedScore,
      evidence: c.evidence,
      missing_evidence: c.missingEvidence,
      confidence: c.confidence,
      interview_questions: c.interviewQuestions,
    }))
  );

  await db.update("applications", { id: eq(params.applicationId) }, {
    ai_recommendation: evaluation.aiRecommendation,
    ai_confidence: evaluation.aiConfidence,
    review_status: "pending_review",
    weighted_total: evaluation.overallScore,
  });

  await logDecisionEvent(params.applicationId, "evaluation_generated", {
    evaluationId: evaluationRow.id,
    overallScore: evaluation.overallScore,
  });
  await logDecisionEvent(params.applicationId, "recommendation_produced", {
    recommendation: evaluation.aiRecommendation,
    confidence: evaluation.aiConfidence,
  });

  return { evaluationId: evaluationRow.id, evaluation };
}
