const RECOMMENDATION_STYLES: Record<string, string> = {
  strong_advance: "bg-success/10 text-success border-success/30",
  advance: "bg-success/10 text-success border-success/30",
  hold: "bg-amber/10 text-amber border-amber/30",
  do_not_advance: "bg-danger/10 text-danger border-danger/30",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold for review",
  do_not_advance: "Do not advance",
};

export function RecommendationBadge({ recommendation }: { recommendation: string | null }) {
  if (!recommendation) return <span className="text-xs text-navy/40">Not evaluated</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        RECOMMENDATION_STYLES[recommendation] ?? "border-stone bg-stone/40 text-navy/70"
      }`}
    >
      {RECOMMENDATION_LABELS[recommendation] ?? recommendation}
    </span>
  );
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "text-success",
  medium: "text-amber",
  low: "text-danger",
};

export function ConfidenceLabel({ confidence }: { confidence: string | null }) {
  if (!confidence) return <span className="text-xs text-navy/40">—</span>;
  return (
    <span className={`text-xs font-medium capitalize ${CONFIDENCE_STYLES[confidence] ?? "text-navy/60"}`}>
      {confidence}
    </span>
  );
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  overridden: "Overridden",
};

const REVIEW_STATUS_STYLES: Record<string, string> = {
  pending_review: "border-stone bg-stone/40 text-navy/70",
  approved: "border-success/30 bg-success/10 text-success",
  overridden: "border-gold/40 bg-gold/10 text-gold-dark",
};

export function ReviewStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        REVIEW_STATUS_STYLES[status] ?? "border-stone bg-stone/40 text-navy/70"
      }`}
    >
      {REVIEW_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const EMAIL_STATUS_LABELS: Record<string, string> = {
  not_generated: "Not generated",
  draft: "Draft",
  draft_generated: "Draft generated",
  edited: "Edited",
  ready_for_review: "Ready for review",
  approved: "Approved",
  sent: "Sent",
  sent_in_test_mode: "Sent (test mode)",
  failed: "Failed",
};

// Blue/navy is reserved for the test-email-sent state per the design spec —
// distinct from the emerald/amber/red used for recommendation states.
const EMAIL_STATUS_STYLES: Record<string, string> = {
  not_generated: "border-stone bg-stone/40 text-navy/50",
  draft: "border-stone bg-stone/40 text-navy/70",
  draft_generated: "border-stone bg-stone/40 text-navy/70",
  edited: "border-gold/40 bg-gold/10 text-gold-dark",
  ready_for_review: "border-gold/40 bg-gold/10 text-gold-dark",
  approved: "border-gold/40 bg-gold/10 text-gold-dark",
  sent: "border-navy/30 bg-navy/5 text-navy",
  sent_in_test_mode: "border-navy/30 bg-navy/5 text-navy",
  failed: "border-danger/30 bg-danger/10 text-danger",
};

export function EmailStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        EMAIL_STATUS_STYLES[status] ?? "border-stone bg-stone/40 text-navy/70"
      }`}
    >
      {EMAIL_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// Kept for legacy rows created before the evaluation workflow existed.
const BAND_STYLES: Record<string, string> = {
  "Strong Pool": "bg-success/10 text-success border-success/30",
  Hold: "bg-amber/10 text-amber border-amber/30",
  Reject: "bg-danger/10 text-danger border-danger/30",
};

export function BandBadge({ band }: { band: string | null }) {
  if (!band) return <span className="text-xs text-navy/40">unscored</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${BAND_STYLES[band] ?? ""}`}>
      {band}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  processing: "Processing",
  scored: "Scored",
  invited: "Invited",
  rejected: "Rejected",
  contacted: "Contacted",
  no_response_yet: "No response yet",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-stone bg-stone/40 px-2.5 py-0.5 text-xs font-medium text-navy/70">
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
