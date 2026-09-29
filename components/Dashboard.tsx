"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UploadForm } from "./UploadForm";
import { RecommendationBadge, ConfidenceLabel, ReviewStatusBadge, EmailStatusBadge, BandBadge } from "./Badges";
import { TestModeBadge } from "./TestModeBadge";

type Application = {
  id: string;
  candidate_name: string | null;
  email: string | null;
  role: "PM" | "SPM";
  status: string;
  weighted_total: number | null;
  band: string | null;
  ai_recommendation: string | null;
  ai_confidence: "high" | "medium" | "low" | null;
  final_recommendation: string | null;
  review_status: string;
  email_status: string;
  created_at: string;
  updated_at: string;
};

const ROLE_OPTIONS = ["All", "PM", "SPM"] as const;
const RECOMMENDATION_OPTIONS = ["All", "strong_advance", "advance", "hold", "do_not_advance"] as const;
const REVIEW_OPTIONS = ["All", "pending_review", "approved", "overridden"] as const;
const EMAIL_OPTIONS = ["All", "not_generated", "draft_generated", "edited", "sent_in_test_mode", "sent", "failed"] as const;
const SORT_OPTIONS = [
  { value: "score_desc", label: "Score (high to low)" },
  { value: "score_asc", label: "Score (low to high)" },
  { value: "confidence_desc", label: "Confidence (high to low)" },
  { value: "date_desc", label: "Upload date (newest)" },
  { value: "date_asc", label: "Upload date (oldest)" },
] as const;

const LABELS: Record<string, Record<string, string>> = {
  recommendation: { All: "All", strong_advance: "Strong advance", advance: "Advance", hold: "Hold", do_not_advance: "Do not advance" },
  review: { All: "All", pending_review: "Pending", approved: "Approved", overridden: "Overridden" },
  email: {
    All: "All",
    not_generated: "Not generated",
    draft_generated: "Draft generated",
    edited: "Edited",
    sent_in_test_mode: "Sent (test)",
    sent: "Sent",
    failed: "Failed",
  },
};

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

type BucketKey =
  | "strong_advance"
  | "advance"
  | "hold"
  | "do_not_advance"
  | "email_draft_ready"
  | "email_sent_test"
  | "not_yet_evaluated"
  | "evaluation_failed";

const BUCKET_ORDER: BucketKey[] = [
  "strong_advance",
  "advance",
  "hold",
  "do_not_advance",
  "email_draft_ready",
  "email_sent_test",
  "not_yet_evaluated",
  "evaluation_failed",
];

const BUCKET_LABELS: Record<BucketKey, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold for review",
  do_not_advance: "Do not advance",
  email_draft_ready: "Email draft ready",
  email_sent_test: "Email sent in test mode",
  not_yet_evaluated: "Not yet evaluated",
  evaluation_failed: "Evaluation failed",
};

const BUCKET_ACCENTS: Record<BucketKey, string> = {
  strong_advance: "border-l-success",
  advance: "border-l-success",
  hold: "border-l-amber",
  do_not_advance: "border-l-danger",
  email_draft_ready: "border-l-navy/30",
  email_sent_test: "border-l-navy",
  not_yet_evaluated: "border-l-stone",
  evaluation_failed: "border-l-danger",
};

function bucketFor(a: Application): BucketKey {
  if (a.status === "evaluation_failed") return "evaluation_failed";
  if (!a.ai_recommendation) return "not_yet_evaluated";
  if (a.email_status === "sent" || a.email_status === "sent_in_test_mode") return "email_sent_test";
  if (a.email_status === "draft_generated" || a.email_status === "edited") return "email_draft_ready";
  const rec = a.final_recommendation ?? a.ai_recommendation;
  if (rec === "strong_advance" || rec === "advance" || rec === "hold" || rec === "do_not_advance") return rec;
  return "not_yet_evaluated";
}

export function Dashboard() {
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("All");
  const [recommendation, setRecommendation] = useState<(typeof RECOMMENDATION_OPTIONS)[number]>("All");
  const [reviewStatus, setReviewStatus] = useState<(typeof REVIEW_OPTIONS)[number]>("All");
  const [emailStatus, setEmailStatus] = useState<(typeof EMAIL_OPTIONS)[number]>("All");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("score_desc");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/applications");
    const data = await res.json();
    setAllApplications(data.applications ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const min = minScore ? Number(minScore) : -Infinity;
    const max = maxScore ? Number(maxScore) : Infinity;
    return allApplications.filter((a) => {
      if (role !== "All" && a.role !== role) return false;
      if (recommendation !== "All" && a.ai_recommendation !== recommendation) return false;
      if (reviewStatus !== "All" && a.review_status !== reviewStatus) return false;
      if (emailStatus !== "All" && a.email_status !== emailStatus) return false;
      const score = a.weighted_total != null ? Number(a.weighted_total) : null;
      if (score != null && (score < min || score > max)) return false;
      return true;
    });
  }, [allApplications, role, recommendation, reviewStatus, emailStatus, minScore, maxScore]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sort) {
        case "score_asc":
          return (Number(a.weighted_total) || 0) - (Number(b.weighted_total) || 0);
        case "confidence_desc":
          return (CONFIDENCE_RANK[b.ai_confidence ?? ""] ?? 0) - (CONFIDENCE_RANK[a.ai_confidence ?? ""] ?? 0);
        case "date_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "score_desc":
        default:
          return (Number(b.weighted_total) || 0) - (Number(a.weighted_total) || 0);
      }
    });
    return copy;
  }, [filtered, sort]);

  const grouped = useMemo(() => {
    const map = new Map<BucketKey, Application[]>();
    for (const key of BUCKET_ORDER) map.set(key, []);
    for (const a of sorted) map.get(bucketFor(a))!.push(a);
    return map;
  }, [sorted]);

  const pendingReview = allApplications.filter((a) => a.review_status === "pending_review" && a.ai_recommendation).length;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <header className="mb-8 border-b border-stone pb-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-dark">Kargo</p>
            <TestModeBadge />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy">Hiring Dashboard</h1>
          <p className="mt-1 text-sm text-navy/60">
            Candidate review for the Product Manager &amp; Senior PM roles ·{" "}
            <span className="font-medium text-navy">{pendingReview}</span> awaiting recruiter review
          </p>
        </header>

        <div className="mb-8">
          <UploadForm onUploaded={load} />
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-stone pb-6">
          <FilterGroup label="Role" options={ROLE_OPTIONS} labels={{ All: "All", PM: "PM", SPM: "SPM" }} value={role} onChange={setRole} />
          <FilterGroup label="Recommendation" options={RECOMMENDATION_OPTIONS} labels={LABELS.recommendation} value={recommendation} onChange={setRecommendation} />
          <FilterGroup label="Review status" options={REVIEW_OPTIONS} labels={LABELS.review} value={reviewStatus} onChange={setReviewStatus} />
          <FilterGroup label="Email status" options={EMAIL_OPTIONS} labels={LABELS.email} value={emailStatus} onChange={setEmailStatus} />
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Score min</label>
              <input
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                className="w-20 border border-stone bg-white px-2 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Score max</label>
              <input
                type="number"
                min={0}
                max={100}
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="w-20 border border-stone bg-white px-2 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Sort by</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="border border-stone bg-white px-2.5 py-1.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="text-sm text-navy/50">Loading...</p>}
        {!loading && allApplications.length === 0 && (
          <div className="border border-dashed border-stone bg-white/50 p-12 text-center">
            <p className="text-sm text-navy/50">No applications yet — upload a CV above to get started.</p>
          </div>
        )}

        {!loading &&
          allApplications.length > 0 &&
          BUCKET_ORDER.map((bucket) => {
            const items = grouped.get(bucket) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={bucket} className="mb-8">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
                  {BUCKET_LABELS[bucket]}
                  <span className="rounded-full bg-stone/60 px-2 py-0.5 text-xs font-normal text-navy/60">{items.length}</span>
                </h2>
                <div className={`overflow-hidden border border-stone border-l-4 bg-white ${BUCKET_ACCENTS[bucket]}`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone bg-ivory/60 text-left text-xs font-medium uppercase tracking-wide text-navy/50">
                        <th className="px-4 py-2.5">Candidate</th>
                        <th className="px-4 py-2.5">Role</th>
                        <th className="px-4 py-2.5">Score</th>
                        <th className="px-4 py-2.5">Recommendation</th>
                        <th className="px-4 py-2.5">Confidence</th>
                        <th className="px-4 py-2.5">Review</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Uploaded</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((app) => (
                        <tr key={app.id} className="border-b border-stone/70 last:border-0 hover:bg-ivory/50">
                          <td className="px-4 py-3 font-medium text-navy">{app.candidate_name ?? "Unnamed candidate"}</td>
                          <td className="px-4 py-3 text-navy/70">{app.role}</td>
                          <td className="px-4 py-3 tabular-nums text-navy/80">
                            {app.weighted_total != null ? Number(app.weighted_total).toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <RecommendationBadge recommendation={app.final_recommendation ?? app.ai_recommendation} />
                            {app.final_recommendation && app.final_recommendation !== app.ai_recommendation && (
                              <span className="ml-1 text-[10px] text-gold-dark">(overridden)</span>
                            )}
                            {!app.ai_recommendation && app.band && <BandBadge band={app.band} />}
                          </td>
                          <td className="px-4 py-3">
                            <ConfidenceLabel confidence={app.ai_confidence} />
                          </td>
                          <td className="px-4 py-3">
                            <ReviewStatusBadge status={app.review_status} />
                          </td>
                          <td className="px-4 py-3">
                            <EmailStatusBadge status={app.email_status} />
                          </td>
                          <td className="px-4 py-3 text-navy/50">{new Date(app.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                              <Link href={`/applications/${app.id}`} className="text-xs font-medium text-gold-dark hover:underline">
                                Review profile
                              </Link>
                              <Link href={`/applications/${app.id}#email`} className="text-xs font-medium text-gold-dark hover:underline">
                                Preview email
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<string, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="border border-stone bg-white px-2.5 py-1.5 text-sm text-navy focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels[opt] ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}
