import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { RUBRIC_MARKDOWN, CRITERIA, recommendationForScore } from "./rubric";
import type {
  AnonymizedExperience,
  PiiExtraction,
  RawEvaluation,
  Evaluation,
  ConfidenceLevel,
  EmailOutcome,
  ReasonDetailLevel,
  CandidateEmailDraft,
} from "./types";

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

const MODEL_NAME = "gemini-3.8-flash";

// --- Step 1: extract structured data from raw CV text, PII kept separate ---

const extractionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    pii: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, nullable: true },
        email: { type: SchemaType.STRING, nullable: true },
        phone: { type: SchemaType.STRING, nullable: true },
        address: { type: SchemaType.STRING, nullable: true },
      },
      required: ["name", "email", "phone", "address"],
    },
    experience: {
      type: SchemaType.OBJECT,
      properties: {
        roles_held: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              organization_type: { type: SchemaType.STRING },
              start_date: { type: SchemaType.STRING, nullable: true },
              end_date: { type: SchemaType.STRING, nullable: true },
              responsibilities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              achievements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ["title", "organization_type", "responsibilities", "achievements"],
          },
        },
        tools_and_platforms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        metrics_mentioned: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ["roles_held", "tools_and_platforms", "metrics_mentioned"],
    },
  },
  required: ["pii", "experience"],
} as const;

export async function extractCandidateData(
  rawText: string
): Promise<{ pii: PiiExtraction; experience: AnonymizedExperience }> {
  const model = client().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: "application/json", responseSchema: extractionSchema as any },
  });

  const prompt = `You are extracting structured data from a candidate's CV/resume for an applicant tracking system.

Split your output into two parts:
1. "pii" — personal identifying details: full name, email, phone, physical address. Use null for any field not present. Do not include a photo description.
2. "experience" — everything else needed to evaluate the candidate's work: roles held (title, organization type/industry — not the literal company name unless needed to describe the industry, start/end dates, responsibilities, achievements), tools/platforms used, and any metrics mentioned. Do NOT include the candidate's name, email, phone, or address anywhere inside "experience".

Only extract what is actually written in the CV text below. Do not invent or infer facts not present.

CV TEXT:
"""
${rawText}
"""`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());
  return parsed;
}

// --- Structured evaluation workflow (human-in-the-loop) ---

const CONFIDENCE_ENUM = { type: SchemaType.STRING, enum: ["high", "medium", "low"] } as const;

const evaluationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    candidateSummary: {
      type: SchemaType.OBJECT,
      properties: {
        totalExperience: { type: SchemaType.STRING },
        productExperience: { type: SchemaType.STRING },
        mostRelevantExperience: { type: SchemaType.STRING },
        relevantProjects: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        relevantTools: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        relevantDomains: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        missingInformation: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: [
        "totalExperience",
        "productExperience",
        "mostRelevantExperience",
        "relevantProjects",
        "relevantTools",
        "relevantDomains",
        "missingInformation",
      ],
    },
    criteria: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          score: { type: SchemaType.INTEGER },
          evidence: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          missingEvidence: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          confidence: CONFIDENCE_ENUM,
          interviewQuestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["name", "score", "evidence", "missingEvidence", "confidence", "interviewQuestions"],
      },
    },
    mustHaveGates: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          gate: { type: SchemaType.STRING },
          passed: { type: SchemaType.BOOLEAN },
          note: { type: SchemaType.STRING, nullable: true },
        },
        required: ["gate", "passed"],
      },
    },
    gatesRequiringValidation: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    strongestMatches: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    transferableExperience: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    materialGaps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    riskFactors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    internalReasoning: { type: SchemaType.STRING },
    candidateFacingReason: { type: SchemaType.STRING },
    recommendedRole: { type: SchemaType.STRING },
    confidence: CONFIDENCE_ENUM,
  },
  required: [
    "candidateSummary",
    "criteria",
    "mustHaveGates",
    "gatesRequiringValidation",
    "strongestMatches",
    "transferableExperience",
    "materialGaps",
    "riskFactors",
    "internalReasoning",
    "candidateFacingReason",
    "recommendedRole",
    "confidence",
  ],
} as const;

export async function runStructuredEvaluation(
  experience: AnonymizedExperience,
  role: "PM" | "SPM"
): Promise<RawEvaluation> {
  const model = client().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: "application/json", responseSchema: evaluationSchema as any },
  });

  const prompt = `You are evaluating a job candidate for Kargo's ${role} role against a fixed rubric. Score ONLY the criteria below — do not invent your own criteria.

${RUBRIC_MARKDOWN}

Candidate experience data (anonymized — no name, email, phone, address, photo, age, gender, ethnicity, nationality, or any other protected characteristic; no employer or university names, so do not use employer/university prestige as a shortcut):
"""
${JSON.stringify(experience, null, 2)}
"""

Rules:
- Use ONLY job-related experience and evidence actually present in the data above. Never invent evidence, and never infer protected characteristics or demographic information.
- For each of the six rubric criteria, provide: "name" (exact criterion label), "score" (0-5 per the rubric's score definitions), "evidence" (array of short quotes/paraphrases from the data that justify the score — empty array if none), "missingEvidence" (array describing what's missing if the score is capped by lack of evidence), "confidence" (high/medium/low — how certain you are given the evidence quality), and "interviewQuestions" (1-2 questions an interviewer should ask to validate this criterion).
- "candidateSummary": total professional experience (plain description, e.g. "~6 years"), product-management-specific experience, most relevant experience for this role, relevant projects, relevant tools, relevant domains, and "missingInformation" (anything a recruiter would want but isn't in the data).
- "mustHaveGates": role-critical must-haves (e.g. "Has shipped a product feature end-to-end", "Has direct logistics/operations exposure") with whether each is passed based on the evidence, and a short note.
- "gatesRequiringValidation": must-haves that can't be confirmed from the resume alone and need interview validation.
- "strongestMatches": the 2-4 strongest pieces of evidence overall.
- "transferableExperience": experience that doesn't directly match but is plausibly transferable.
- "materialGaps": gaps that would materially affect performance in this specific role (not nitpicks).
- "riskFactors": any other risk signals visible in the evidence (e.g. short tenures, unexplained gaps in the data provided) — never speculate about personal circumstances.
- "internalReasoning": a detailed recruiter-facing explanation (this is NEVER shown to the candidate) — why the candidate matches or doesn't, strongest evidence, which gaps are trainable vs material, what to validate in an interview, and why.
- "candidateFacingReason": a separate, short, polite, job-related explanation suitable for eventually sharing with the candidate if needed — no scores, no comparisons to other candidates, no confidential details, no harsh language.
- "recommendedRole": which role (PM or SPM) this candidate's evidence best fits, which may differ from the role they applied for.
- "confidence": your overall confidence in this evaluation given evidence completeness.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as RawEvaluation;
}

function clampScore(score: unknown): number {
  const n = typeof score === "number" && Number.isFinite(score) ? Math.round(score) : 0;
  return Math.min(5, Math.max(0, n));
}

function toConfidence(value: unknown): ConfidenceLevel {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// Validates and normalizes Gemini's raw JSON into a trustworthy shape before it
// ever reaches the database or the UI. Recomputes every number server-side —
// the model's own math is never trusted — and never lets a criterion or field
// silently vanish just because the model omitted it.
export function validateAndNormalizeEvaluation(
  raw: RawEvaluation
): Omit<Evaluation, "id" | "applicationId" | "rubricVersion" | "createdAt"> {
  const rawCriteria = Array.isArray(raw.criteria) ? raw.criteria : [];

  let overallScore = 0;
  const criteria = CRITERIA.map((c) => {
    const match = rawCriteria.find((r) => r?.name === c.label);
    const score = clampScore(match?.score);
    const weightedScore = Math.round(((score / 5) * c.weight) * 100) / 100;
    overallScore += weightedScore;
    return {
      name: c.label,
      weight: c.weight,
      score,
      weightedScore,
      evidence: match ? toStringArray(match.evidence) : [],
      missingEvidence: match && toStringArray(match.evidence).length > 0 ? toStringArray(match.missingEvidence) : ["Not evidenced"],
      confidence: match ? toConfidence(match.confidence) : "low",
      interviewQuestions: match ? toStringArray(match.interviewQuestions) : [],
    };
  });
  overallScore = Math.round(overallScore * 100) / 100;

  const summary = raw.candidateSummary ?? {};
  const candidateSummary = {
    totalExperience: typeof summary.totalExperience === "string" ? summary.totalExperience : "Not evidenced",
    productExperience: typeof summary.productExperience === "string" ? summary.productExperience : "Not evidenced",
    mostRelevantExperience:
      typeof summary.mostRelevantExperience === "string" ? summary.mostRelevantExperience : "Not evidenced",
    relevantProjects: toStringArray(summary.relevantProjects),
    relevantTools: toStringArray(summary.relevantTools),
    relevantDomains: toStringArray(summary.relevantDomains),
    missingInformation: toStringArray(summary.missingInformation),
  };

  const mustHaveGates = Array.isArray(raw.mustHaveGates)
    ? raw.mustHaveGates
        .filter((g) => g && typeof g.gate === "string")
        .map((g) => ({ gate: g.gate, passed: Boolean(g.passed), note: typeof g.note === "string" ? g.note : undefined }))
    : [];

  return {
    candidateSummary,
    criteria,
    overallScore,
    mustHaveGates,
    gatesRequiringValidation: toStringArray(raw.gatesRequiringValidation),
    strongestMatches: toStringArray(raw.strongestMatches),
    transferableExperience: toStringArray(raw.transferableExperience),
    materialGaps: toStringArray(raw.materialGaps),
    riskFactors: toStringArray(raw.riskFactors),
    internalReasoning:
      typeof raw.internalReasoning === "string" && raw.internalReasoning.trim()
        ? raw.internalReasoning
        : "Not evidenced.",
    candidateFacingReason:
      typeof raw.candidateFacingReason === "string" && raw.candidateFacingReason.trim()
        ? raw.candidateFacingReason
        : "Thank you for your interest — we will follow up after review.",
    recommendedRole: typeof raw.recommendedRole === "string" ? raw.recommendedRole : "",
    // Deterministic from the rubric thresholds — never trust a free-form model label here.
    aiRecommendation: recommendationForScore(overallScore),
    aiConfidence: toConfidence(raw.confidence),
  };
}

// --- Candidate-facing email generation (recruiter-approved decision only) ---

const emailSchema = {
  type: SchemaType.OBJECT,
  properties: {
    subject: { type: SchemaType.STRING },
    body: { type: SchemaType.STRING },
  },
  required: ["subject", "body"],
} as const;

export type HoldSubtype = "request_info" | "neutral_update";

export async function generateCandidateEmail(params: {
  candidateName: string | null;
  role: "PM" | "SPM";
  outcome: EmailOutcome;
  tone: string;
  reasonDetailLevel: ReasonDetailLevel;
  customReason?: string;
  holdSubtype?: HoldSubtype;
  strongestMatches: string[];
  materialGaps: string[];
  candidateFacingReason: string;
}): Promise<CandidateEmailDraft> {
  const model = client().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: "application/json", responseSchema: emailSchema as any },
  });

  const name = params.candidateName ?? "there";

  const holdInstruction =
    params.holdSubtype === "request_info"
      ? "A polite email requesting specific additional information or clarification needed to continue evaluating them (frame it as a request, not a status update). Do not specify exactly what to ask for unless it's obvious from context — keep it general (e.g. 'a few additional details about your recent experience')."
      : "A neutral status-update email: thank them, let them know the application remains under review, no false promises about outcome or timeline.";

  const outcomeInstruction: Record<EmailOutcome, string> = {
    strong_advance:
      "An enthusiastic, appreciative email advancing them to the next interview stage. Recognize 1-2 specific verified strengths. Do not guarantee employment — this is an interview stage, not an offer.",
    advance:
      "A warm email advancing them to the next interview stage, thanking them and naming what stood out. Do not guarantee employment — this is an interview stage, not an offer.",
    hold: holdInstruction,
    reject: "A polite, respectful, professional rejection email.",
  };

  let reasonInstruction = "";
  if (params.outcome === "reject") {
    if (params.reasonDetailLevel === "none") {
      reasonInstruction =
        'Do not state any specific reason. Use only a generic phrase like "after careful review of applications for this role."';
    } else if (params.reasonDetailLevel === "custom" && params.customReason) {
      reasonInstruction = `Use exactly this recruiter-provided reason, worded naturally into the email (do not alter its meaning): "${params.customReason}"`;
    } else {
      reasonInstruction = `Include exactly ONE concise, job-related reason drawn ONLY from this verified gap (do not invent a different reason, do not soften it into something not supported by the evidence): "${
        params.materialGaps[0] ?? "the role currently requires a different scope of experience"
      }"`;
    }
  }

  const prompt = `Draft a candidate-facing email for a ${params.role} role applicant named ${name}, in a ${params.tone.replace(
    /_/g,
    " "
  )} tone.

Outcome: ${params.outcome}
Instruction: ${outcomeInstruction[params.outcome]}
${reasonInstruction}

Verified strengths you may reference (only if the outcome is advance/strong_advance — never invent strengths not listed here): ${JSON.stringify(
    params.strongestMatches
  )}

Hard rules:
- Never include any numeric score, rubric criterion name, or weight.
- Never compare this candidate to any other named or unnamed candidate.
- Never use or imply any protected characteristic (age, gender, race, ethnicity, religion, caste, nationality, disability, health, marital status, pregnancy, sexual orientation).
- Never mention the candidate's name in a way that implies you know personal details beyond what's professionally relevant.
- Never frame missing or unevidenced information as a confirmed lack of ability — the resume not mentioning something is not proof the candidate lacks it.
- Keep it concise, polite, and free of confidential internal deliberation.
- Sign off as "The Kargo Hiring Team".
- Return "subject" and "body" only.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as CandidateEmailDraft;
}
