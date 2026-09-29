"use client";

import { useState } from "react";
import type { Criterion } from "./Workspace";

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-success",
  medium: "text-amber",
  low: "text-danger",
};

export function CriterionScores({ criteria, overallScore }: { criteria: Criterion[]; overallScore: number }) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">Rubric evaluation</h2>
        <p className="text-sm text-navy/60">
          Overall score <span className="text-lg font-semibold text-navy">{overallScore.toFixed(1)}</span>
          <span className="text-navy/40"> / 100</span>
        </p>
      </div>
      <div className="mt-3 divide-y divide-stone border border-stone bg-white">
        {criteria.map((c) => (
          <CriterionRow key={c.criterion} criterion={c} />
        ))}
      </div>
    </section>
  );
}

function CriterionRow({ criterion }: { criterion: Criterion }) {
  const [open, setOpen] = useState(false);
  const evidenceMissing = criterion.evidence.length === 0;

  return (
    <div className="p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-navy">{criterion.criterion}</span>
            <span className="text-xs text-navy/40">({criterion.weight}% weight)</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-stone/60">
            <div className="h-full bg-gold" style={{ width: `${(criterion.score / 5) * 100}%` }} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm">
          <span className="tabular-nums text-navy/70">{criterion.score}/5</span>
          <span className={`text-xs font-medium capitalize ${CONFIDENCE_COLOR[criterion.confidence]}`}>
            {criterion.confidence}
          </span>
          <span className="text-navy/40">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-stone pt-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-navy/40">Evidence</p>
            {evidenceMissing ? (
              <p className="mt-1 text-navy/50">Not evidenced.</p>
            ) : (
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-navy/80">
                {criterion.evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
          {criterion.missing_evidence.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-navy/40">Missing evidence</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-navy/60">
                {criterion.missing_evidence.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {criterion.interview_questions.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-navy/40">Interview validation questions</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-navy/80">
                {criterion.interview_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
