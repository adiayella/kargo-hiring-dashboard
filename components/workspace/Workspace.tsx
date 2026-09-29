"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CriterionScores } from "./CriterionScores";
import { DecisionPanel } from "./DecisionPanel";
import { EmailComposerPanel } from "./EmailComposer";
import { Timeline } from "./Timeline";
import { ResumePreview } from "./ResumePreview";
import { DeleteCandidate } from "./DeleteCandidate";
import { RecommendationBadge } from "../Badges";
import { TestModeBadge } from "../TestModeBadge";

export type Criterion = {
  criterion: string;
  weight: number;
  score: number;
  weighted_score: number;
  evidence: string[];
  missing_evidence: string[];
  confidence: "high" | "medium" | "low";
  interview_questions: string[];
};

export type EvaluationData = {
  id: string;
  rubric_version: string;
  candidate_summary: {
    totalExperience: string;
    productExperience: string;
    mostRelevantExperience: string;
    relevantProjects: string[];
    relevantTools: string[];
    relevantDomains: string[];
    missingInformation: string[];
  };
  must_have_gates: { gate: string; passed: boolean; note?: string }[];
  gates_requiring_validation: string[];
  strongest_matches: string[];
  transferable_experience: string[];
  material_gaps: string[];
  risk_factors: string[];
  internal_reasoning: string;
  candidate_facing_reason: string;
  recommended_role: string;
  overall_score: number;
  ai_recommendation: string;
  ai_confidence: "high" | "medium" | "low";
  created_at: string;
};

export type ApplicationData = {
  id: string;
  candidate_name: string | null;
  email: string | null;
  role: "PM" | "SPM";
  file_url: string;
  file_name: string;
  status: string;
  weighted_total: number | null;
  ai_recommendation: string | null;
  ai_confidence: string | null;
  final_recommendation: string | null;
  recommendation_overridden: boolean;
  review_status: string;
  reviewed_at: string | null;
  reviewer: string | null;
  email_status: string;
};

export type Draft = {
  id: string;
  email_subject: string;
  email_body: string;
  recipient: string | null;
  tone: string;
  reason_detail_level: "none" | "brief" | "custom";
  status: "draft" | "approved" | "sent" | "failed";
  ai_generated: boolean;
  recruiter_edited: boolean;
  sent_at: string | null;
  email_outcome: string | null;
  created_at: string;
};

export type TimelineEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export function Workspace({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [candidate, setCandidate] = useState<{ raw_text: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/applications/${applicationId}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setApplication(data.application);
    setEvaluation(data.evaluation);
    setCriteria(data.criteria ?? []);
    setDrafts(data.drafts ?? []);
    setTimeline(data.timeline ?? []);
    setCandidate(data.candidate);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && window.location.hash === "#email") {
      document.getElementById("email")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm text-navy/50">Loading...</p>
      </div>
    );
  }

  if (notFound || !application) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm text-navy/50">Application not found.</p>
        <Link href="/" className="mt-2 inline-block text-sm text-gold-dark underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const latestDraft = drafts[0] ?? null;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <div className="mb-6 border-b border-stone pb-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xs font-medium uppercase tracking-wide text-navy/50 hover:text-gold-dark">
              ← Candidate queue
            </Link>
            <TestModeBadge />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-navy">
                {application.candidate_name ?? "Unnamed candidate"}
              </h1>
              <p className="mt-1 text-sm text-navy/60">
                {application.role === "PM" ? "Product Manager" : "Senior Product Manager"} ·{" "}
                {application.email ?? "no email on file"}
              </p>
              <p className="mt-0.5 font-mono text-xs text-navy/40">Candidate ID: {application.id}</p>
            </div>
            <div className="flex items-center gap-2">
              <RecommendationBadge recommendation={application.final_recommendation ?? application.ai_recommendation} />
            </div>
          </div>
        </div>

        {!evaluation && application.status === "evaluation_failed" && (
          <div className="mb-6 border border-danger/30 bg-danger/5 p-4 text-sm text-navy/70">
            <p className="font-medium text-danger">Evaluation failed for this candidate.</p>
            <p className="mt-1">
              The resume couldn&apos;t be processed (often an unreadable or corrupted file). Check the resume preview
              below, then re-upload a valid file if needed — this record is safe to delete.
            </p>
          </div>
        )}

        {!evaluation && application.status !== "evaluation_failed" && (
          <div className="mb-6 border border-stone bg-ivory/60 p-4 text-sm text-navy/70">
            This application predates the structured evaluation workflow and has no rubric-criterion
            breakdown to review. Legacy score:{" "}
            <span className="font-medium">{application.weighted_total ?? "—"}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          {/* Left column: candidate profile, evidence, gaps */}
          <div className="space-y-8">
            {evaluation && (
              <>
                <section>
                  <SectionTitle>Candidate summary</SectionTitle>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 border border-stone bg-white p-5 text-sm">
                    <SummaryField label="Total experience" value={evaluation.candidate_summary.totalExperience} />
                    <SummaryField label="Product experience" value={evaluation.candidate_summary.productExperience} />
                    <SummaryField
                      label="Most relevant experience"
                      value={evaluation.candidate_summary.mostRelevantExperience}
                      span
                    />
                    <SummaryListField label="Relevant projects" items={evaluation.candidate_summary.relevantProjects} span />
                    <SummaryListField label="Relevant tools" items={evaluation.candidate_summary.relevantTools} />
                    <SummaryListField label="Relevant domains" items={evaluation.candidate_summary.relevantDomains} />
                    <SummaryListField
                      label="Information not evidenced"
                      items={evaluation.candidate_summary.missingInformation}
                      span
                      muted
                    />
                  </div>
                </section>

                <CriterionScores criteria={criteria} overallScore={evaluation.overall_score} />

                <section>
                  <SectionTitle>Must-have gates</SectionTitle>
                  <div className="mt-3 space-y-2 border border-stone bg-white p-5">
                    {evaluation.must_have_gates.length === 0 && <p className="text-sm text-navy/50">Not evidenced.</p>}
                    {evaluation.must_have_gates.map((g, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 ${g.passed ? "text-success" : "text-danger"}`}>{g.passed ? "✓" : "✗"}</span>
                        <div>
                          <span className="font-medium text-navy">{g.gate}</span>
                          {g.note && <p className="text-navy/60">{g.note}</p>}
                        </div>
                      </div>
                    ))}
                    {evaluation.gates_requiring_validation.length > 0 && (
                      <div className="mt-3 border-t border-stone pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-navy/50">Needs interview validation</p>
                        <ul className="mt-1 list-inside list-disc text-sm text-navy/70">
                          {evaluation.gates_requiring_validation.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ListCard title="Strongest matches" items={evaluation.strongest_matches} accent="success" />
                  <ListCard title="Transferable experience" items={evaluation.transferable_experience} accent="gold" />
                  <ListCard title="Material gaps" items={evaluation.material_gaps} accent="amber" />
                  <ListCard title="Risk factors" items={evaluation.risk_factors} accent="danger" />
                </section>
              </>
            )}

            <ResumePreview
              candidateName={application.candidate_name}
              fileUrl={application.file_url}
              fileName={application.file_name}
              rawText={candidate?.raw_text ?? null}
            />
          </div>

          {/* Right column: decision, reasoning, email composer, timeline */}
          <div className="space-y-8">
            {evaluation && (
              <DecisionPanel
                applicationId={applicationId}
                application={application}
                evaluation={evaluation}
                locked={drafts.some((d) => d.status === "sent")}
                onChanged={load}
              />
            )}

            {evaluation && (
              <EmailComposerPanel
                applicationId={applicationId}
                application={application}
                latestDraft={latestDraft}
                onChanged={load}
              />
            )}

            <Timeline events={timeline} />

            <DeleteCandidate applicationId={applicationId} candidateName={application.candidate_name} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">{children}</h2>;
}

function SummaryField({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide text-navy/40">{label}</p>
      <p className="mt-0.5 text-navy">{value || "Not evidenced"}</p>
    </div>
  );
}

function SummaryListField({
  label,
  items,
  span,
  muted,
}: {
  label: string;
  items: string[];
  span?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={span ? "col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide text-navy/40">{label}</p>
      {items.length === 0 ? (
        <p className={`mt-0.5 ${muted ? "text-navy/40" : "text-navy"}`}>Not evidenced</p>
      ) : (
        <p className={`mt-0.5 ${muted ? "text-navy/50" : "text-navy"}`}>{items.join(", ")}</p>
      )}
    </div>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  success: "border-success/30 text-success",
  gold: "border-gold/40 text-gold-dark",
  amber: "border-amber/30 text-amber",
  danger: "border-danger/30 text-danger",
};

function ListCard({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <div className="border border-stone bg-white p-4">
      <p className={`text-xs font-semibold uppercase tracking-wide ${ACCENT_CLASSES[accent].split(" ")[1]}`}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-navy/40">Not evidenced</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-navy/80">
          {items.map((item, i) => (
            <li key={i} className="flex gap-1.5">
              <span className={ACCENT_CLASSES[accent].split(" ")[1]}>·</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
