"use client";

import type { TimelineEvent } from "./Workspace";

const EVENT_LABELS: Record<string, string> = {
  resume_uploaded: "Resume uploaded",
  evaluation_generated: "Evaluation generated",
  evaluation_failed: "Evaluation failed",
  recommendation_produced: "AI recommendation produced",
  recruiter_reviewed: "Recruiter reviewed",
  email_drafted: "Email draft generated",
  email_approved: "Email draft approved",
  email_sent: "Email sent",
  email_failed: "Email send failed",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="border border-stone bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">Decision timeline</h2>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-navy/40">No activity recorded yet.</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l border-stone pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-gold" />
              <p className="text-sm font-medium text-navy">{EVENT_LABELS[e.event_type] ?? e.event_type}</p>
              <p className="text-xs text-navy/50">{new Date(e.created_at).toLocaleString()}</p>
              {e.event_type === "recruiter_reviewed" && typeof e.payload.overridden === "boolean" && e.payload.overridden && (
                <p className="text-xs text-amber">Overrode AI recommendation</p>
              )}
              {(e.event_type === "email_failed" || e.event_type === "evaluation_failed") && typeof e.payload.error === "string" && (
                <p className="text-xs text-danger">{e.payload.error}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
