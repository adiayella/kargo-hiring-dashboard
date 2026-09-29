import type { Recommendation } from "./types";

// Bump this whenever RUBRIC_MARKDOWN or CRITERIA weights change, so stored
// evaluations stay traceable to the exact criteria version that produced them.
export const RUBRIC_VERSION = "kargo-pm-spm-rubric-v1";

// Verbatim from kargo_pm_hiring_rubric.md — do not let the model invent its own criteria.
export const RUBRIC_MARKDOWN = `
## Criteria and Score Definitions

### 1. Autonomous Ownership — Weight 25%
No senior layer making the calls; the candidate owned outcomes end-to-end.
- 0: No evidence of independent ownership; always described as supporting others.
- 1: Owned small tasks under close supervision.
- 2: Owned a defined piece of work but with regular approval checkpoints.
- 3: Owned a function or account with normal manager oversight.
- 4: Owned a function/area with explicit "no layer above" or "no escalation" language.
- 5: Explicitly the sole owner of a domain with stated trust/autonomy from leadership.

### 2. Quantified Impact — Weight 20%
Work is tied to specific, verifiable numbers (not vague claims).
- 0: No numbers anywhere.
- 1: Vague or unverifiable claims ("significant improvement").
- 2: One or two soft metrics.
- 3: Several concrete metrics tied to the role's core work.
- 4: Multiple strong, specific metrics across different responsibilities.
- 5: Multiple strong metrics plus evidence of sustained impact over time (quarters/years).

### 3. Zero-to-One / Built-From-Scratch Instinct — Weight 20%
Created a process, tool, program, or feature where none existed, on their own initiative.
- 0: No evidence of building anything new; maintained existing systems only.
- 1: Minor tweak to an existing process.
- 2: Built something new but under direction.
- 3: Built one clear thing from scratch, self-initiated.
- 4: Built multiple things from scratch, later adopted as standard by others.
- 5: Repeated pattern of building from scratch across roles, each adopted org-wide.

### 4. Cross-Functional Collaboration — Weight 15%
Routinely worked across engineering, sales, customer ops, or leadership to get things done.
- 0: No cross-functional evidence.
- 1: Occasional handoff to one other function.
- 2: Regular coordination with one adjacent function.
- 3: Regular coordination with two or more functions.
- 4: Drove alignment across three or more functions, including leadership.
- 5: Named as the trusted cross-functional decision point by another function/leader.

### 5. Domain Grounding — Logistics / Freight / Ports / Customs / Operations-Heavy Industries — Weight 15%
Direct, hands-on exposure to the operational world Kargo automates.
- 0: No domain exposure.
- 1: Adjacent domain only (e.g., generic e-commerce logistics, not freight forwarding).
- 2: Brief or indirect domain exposure.
- 3: Solid domain experience in a non-product role (ops, docs, sales, CS).
- 4: Deep domain experience plus some product/tech-adjacent work.
- 5: Deep domain experience combined with product ownership in that exact domain.

### 6. Technical / Integration Complexity — Weight 5%
Direct experience with APIs, platforms, webhooks, ERPs, or third-party system integrations.
- 0: No technical/integration evidence.
- 1: Used tools that touch data (SQL, analytics) but no integration work.
- 2: Indirect exposure (worked adjacent to an integration project).
- 3: Some direct integration/API work.
- 4: Owned an integration or platform-layer service.
- 5: Owned multiple integrations/platform services with reliability metrics attached.
`.trim();

export const CRITERIA = [
  { key: "autonomous_ownership", label: "Autonomous Ownership", weight: 25 },
  { key: "quantified_impact", label: "Quantified Impact", weight: 20 },
  { key: "zero_to_one", label: "Zero-to-One / Built-From-Scratch Instinct", weight: 20 },
  { key: "cross_functional", label: "Cross-Functional Collaboration", weight: 15 },
  { key: "domain_grounding", label: "Domain Grounding", weight: 15 },
  { key: "technical_integration", label: "Technical / Integration Complexity", weight: 5 },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

// Suggested thresholds only — the recommendation is never the sole decision
// factor; a recruiter reviews the underlying evidence before anything is final.
export function recommendationForScore(total: number): Recommendation {
  if (total >= 80) return "strong_advance";
  if (total >= 65) return "advance";
  if (total >= 50) return "hold";
  return "do_not_advance";
}

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold for review",
  do_not_advance: "Do not advance",
};
