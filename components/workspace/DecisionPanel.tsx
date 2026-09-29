"use client";

import { useEffect, useState } from "react";
import type { ApplicationData, EvaluationData } from "./Workspace";

const RECOMMENDATION_OPTIONS = [
  { value: "strong_advance", label: "Strong advance" },
  { value: "advance", label: "Advance" },
  { value: "hold", label: "Hold for review" },
  { value: "do_not_advance", label: "Do not advance" },
];

export function DecisionPanel({
  applicationId,
  application,
  evaluation,
  locked,
  onChanged,
}: {
  applicationId: string;
  application: ApplicationData;
  evaluation: EvaluationData;
  locked: boolean;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState(application.final_recommendation ?? application.ai_recommendation ?? "hold");
  const [reviewer, setReviewer] = useState(application.reviewer ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  // Keep the form in sync if the underlying application data changes from
  // outside this component (e.g. after a save elsewhere triggers a reload).
  useEffect(() => {
    setSelected(application.final_recommendation ?? application.ai_recommendation ?? "hold");
    setReviewer(application.reviewer ?? "");
  }, [application.final_recommendation, application.ai_recommendation, application.reviewer]);

  const decided = application.review_status !== "pending_review";

  async function submitDecision() {
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch(`/api/applications/${applicationId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalRecommendation: selected, reviewer: reviewer || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save decision");
      }
      onChanged();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save decision");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-stone bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">Recruiter decision</h2>

      {locked && (
        <div className="mt-3 border border-navy/20 bg-navy/5 p-3 text-sm text-navy/70">
          An email has already been sent for this candidate, so the decision is now locked and can no longer be
          changed.
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border border-stone bg-ivory/50 px-3 py-2 text-sm">
        <span className="text-navy/60">AI recommendation</span>
        <span className="font-medium text-navy">
          {RECOMMENDATION_OPTIONS.find((o) => o.value === application.ai_recommendation)?.label ?? "—"}
          <span className="ml-2 text-xs font-normal capitalize text-navy/50">({evaluation.ai_confidence} confidence)</span>
        </span>
      </div>

      <button
        onClick={() => setShowReasoning((v) => !v)}
        className="mt-3 text-xs font-medium text-gold-dark hover:underline"
      >
        {showReasoning ? "Hide" : "Show"} internal reasoning
      </button>
      {showReasoning && (
        <div className="mt-2 space-y-3 border border-stone bg-ivory/30 p-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-navy/40">Internal reasoning (never sent to candidate)</p>
            <p className="mt-1 whitespace-pre-line text-navy/80">{evaluation.internal_reasoning}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-navy/40">Candidate-facing reason (draft basis)</p>
            <p className="mt-1 text-navy/70">{evaluation.candidate_facing_reason}</p>
          </div>
          {evaluation.recommended_role && evaluation.recommended_role !== application.role && (
            <p className="text-xs text-amber">
              Note: evidence best fits <span className="font-medium">{evaluation.recommended_role}</span>, not the applied-for role.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3 border-t border-stone pt-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Final recommendation</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={locked}
            className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:cursor-not-allowed disabled:bg-stone/20 disabled:opacity-60"
          >
            {RECOMMENDATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Reviewer (optional)</label>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Your name"
            disabled={locked}
            className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:cursor-not-allowed disabled:bg-stone/20 disabled:opacity-60"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {!locked && (
          <button
            onClick={submitDecision}
            disabled={saving}
            className="w-full border border-navy bg-navy px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-charcoal disabled:opacity-50"
          >
            {saving ? "Saving..." : decided ? "Update decision" : "Confirm decision"}
          </button>
        )}
        {justSaved && <p className="text-center text-xs font-medium text-success">Decision saved.</p>}
        {decided && (
          <p className="text-center text-xs text-navy/50">
            {application.recommendation_overridden ? "Overridden" : "Approved"} by {application.reviewer || "recruiter"} on{" "}
            {application.reviewed_at && new Date(application.reviewed_at).toLocaleString()}
          </p>
        )}
      </div>
    </section>
  );
}
