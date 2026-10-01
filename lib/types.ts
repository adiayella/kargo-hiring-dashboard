export interface PiiExtraction {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface AnonymizedExperience {
  roles_held: {
    title: string;
    organization_type: string; // e.g. "logistics SaaS", "B2B enterprise" — never the real company name if it would identify the candidate indirectly is fine, company names are not PII of the person
    start_date: string | null;
    end_date: string | null;
    responsibilities: string[];
    achievements: string[];
  }[];
  tools_and_platforms: string[];
  metrics_mentioned: string[];
}

// --- Structured evaluation workflow ---

export type ConfidenceLevel = "high" | "medium" | "low";
export type Recommendation = "strong_advance" | "advance" | "hold" | "do_not_advance";
export type EmailOutcome = "strong_advance" | "advance" | "hold" | "reject";
export type ReasonDetailLevel = "none" | "brief" | "custom";

export interface CandidateSummary {
  totalExperience: string;
  productExperience: string;
  mostRelevantExperience: string;
  relevantProjects: string[];
  relevantTools: string[];
  relevantDomains: string[];
  missingInformation: string[];
}

export interface EvaluationCriterionResult {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  evidence: string[];
  missingEvidence: string[];
  confidence: ConfidenceLevel;
  interviewQuestions: string[];
}

// The raw shape the model is asked to return. Treated as untrusted until
// validateEvaluation() below checks it against the rubric and clamps values.
export interface RawEvaluation {
  candidateSummary: Omit<CandidateSummary, never> & Record<string, unknown>;
  criteria: {
    name: string;
    score: number;
    evidence: string[];
    missingEvidence: string[];
    confidence: ConfidenceLevel;
    interviewQuestions: string[];
  }[];
  mustHaveGates: { gate: string; passed: boolean; note?: string }[];
  gatesRequiringValidation: string[];
  strongestMatches: string[];
  transferableExperience: string[];
  materialGaps: string[];
  riskFactors: string[];
  internalReasoning: string;
  candidateFacingReason: string;
  recommendedRole: string;
  confidence: ConfidenceLevel;
}

export interface Evaluation {
  id: string;
  applicationId: string;
  rubricVersion: string;
  candidateSummary: CandidateSummary;
  criteria: EvaluationCriterionResult[];
  overallScore: number;
  mustHaveGates: { gate: string; passed: boolean; note?: string }[];
  gatesRequiringValidation: string[];
  strongestMatches: string[];
  transferableExperience: string[];
  materialGaps: string[];
  riskFactors: string[];
  internalReasoning: string;
  candidateFacingReason: string;
  recommendedRole: string;
  aiRecommendation: Recommendation;
  aiConfidence: ConfidenceLevel;
  createdAt: string;
}

export interface CandidateEmailDraft {
  subject: string;
  body: string;
}
