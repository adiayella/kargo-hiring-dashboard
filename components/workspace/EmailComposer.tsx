"use client";

import { useEffect, useState } from "react";
import type { ApplicationData, Draft } from "./Workspace";
import { EmailStatusBadge } from "../Badges";
import { useEmailDeliveryConfig } from "../TestModeBadge";

const TONE_OPTIONS = [
  { value: "warm_professional", label: "Warm & professional" },
  { value: "formal", label: "Formal" },
  { value: "friendly_concise", label: "Friendly & concise" },
];

const REASON_OPTIONS = [
  { value: "none", label: "No specific reason" },
  { value: "brief", label: "Brief role-related reason" },
  { value: "custom", label: "Recruiter-edited reason" },
];

const HOLD_SUBTYPE_OPTIONS = [
  { value: "neutral_update", label: "Neutral status update" },
  { value: "request_info", label: "Request additional information" },
];

const RECOMMENDATION_LABELS: Record<string, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold for review",
  do_not_advance: "Do not advance",
};

export function EmailComposerPanel({
  applicationId,
  application,
  latestDraft,
  onChanged,
}: {
  applicationId: string;
  application: ApplicationData;
  latestDraft: Draft | null;
  onChanged: () => void;
}) {
  const deliveryConfig = useEmailDeliveryConfig();

  const [tone, setTone] = useState(latestDraft?.tone ?? "warm_professional");
  const [reasonDetailLevel, setReasonDetailLevel] = useState<"none" | "brief" | "custom">(
    latestDraft?.reason_detail_level ?? "brief"
  );
  const [holdSubtype, setHoldSubtype] = useState<"request_info" | "neutral_update">("neutral_update");
  const [customReason, setCustomReason] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [subject, setSubject] = useState(latestDraft?.email_subject ?? "");
  const [body, setBody] = useState(latestDraft?.email_body ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(latestDraft?.created_at ?? null);

  const [reviewedProfile, setReviewedProfile] = useState(false);
  const [reviewedEmail, setReviewedEmail] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ messageId: string; actualRecipient: string } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSubject(latestDraft?.email_subject ?? "");
    setBody(latestDraft?.email_body ?? "");
    setDirty(false);
    setReviewedProfile(false);
    setReviewedEmail(false);
    setSendResult(null);
    if (latestDraft?.created_at) setLastSavedAt(latestDraft.created_at);
  }, [latestDraft?.id]);

  const isRejectOutcome = application.final_recommendation === "do_not_advance";
  const isHoldOutcome = application.final_recommendation === "hold";
  const canGenerate = application.review_status !== "pending_review";
  const alreadySent = latestDraft?.status === "sent";

  async function generate() {
    if (isRejectOutcome && reasonDetailLevel === "custom" && !customReason.trim()) {
      setGenError("Enter the recruiter-edited reason before generating, or choose a different rejection detail option.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          reasonDetailLevel: isRejectOutcome ? reasonDetailLevel : "brief",
          customReason: reasonDetailLevel === "custom" ? customReason : undefined,
          holdSubtype: isHoldOutcome ? holdSubtype : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate draft");
      }
      onChanged();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdits() {
    if (!latestDraft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/email/${latestDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save edits");
      }
      setDirty(false);
      setLastSavedAt(new Date().toISOString());
      onChanged();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to save edits");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdits() {
    setSubject(latestDraft?.email_subject ?? "");
    setBody(latestDraft?.email_body ?? "");
    setDirty(false);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — not critical
    }
  }

  async function confirmSend() {
    if (!latestDraft) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/email/${latestDraft.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          confirmedProfileReview: reviewedProfile,
          confirmedEmailReview: reviewedEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setSendResult({ messageId: data.messageId, actualRecipient: data.actualRecipient });
      setConfirmingSend(false);
      onChanged();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function sendAnother() {
    setSendResult(null);
    setReviewedProfile(false);
    setReviewedEmail(false);
    setSendError(null);
  }

  if (!canGenerate) {
    return (
      <section id="email" className="border border-stone bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">Candidate email</h2>
        <p className="mt-3 text-sm text-navy/50">Select a final decision before an email can be drafted.</p>
      </section>
    );
  }

  const canSend =
    Boolean(latestDraft) &&
    !alreadySent &&
    !dirty &&
    Boolean(deliveryConfig?.testRecipient) &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    reviewedProfile &&
    reviewedEmail;

  return (
    <section id="email" className="border border-stone bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">Candidate email</h2>
        {latestDraft && <EmailStatusBadge status={latestDraft.status} />}
      </div>

      {deliveryConfig?.mode === "test" && (
        <div className="mt-3 border border-amber/30 bg-amber/5 p-3 text-xs text-navy/70">
          <p className="font-semibold uppercase tracking-wide text-amber">Test mode active</p>
          <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
            <span>
              Intended recipient: <span className="font-medium text-navy">{application.email ?? "not on file"}</span>
            </span>
            <span>
              Actual test recipient: <span className="font-medium text-navy">{deliveryConfig.testRecipient}</span>
            </span>
          </div>
          <p className="mt-1">No email can be delivered to the candidate while test mode is active.</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={alreadySent}
            className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
          >
            {TONE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {isRejectOutcome && (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Rejection detail</label>
            <select
              value={reasonDetailLevel}
              onChange={(e) => setReasonDetailLevel(e.target.value as any)}
              disabled={alreadySent}
              className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
            >
              {REASON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {isHoldOutcome && (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Message type</label>
            <select
              value={holdSubtype}
              onChange={(e) => setHoldSubtype(e.target.value as any)}
              disabled={alreadySent}
              className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
            >
              {HOLD_SUBTYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isRejectOutcome && reasonDetailLevel === "custom" && (
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Recruiter-edited reason</label>
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            rows={2}
            placeholder="e.g. The role currently requires deeper platform integration experience."
            className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={generate}
          disabled={generating || alreadySent}
          className="border border-navy bg-navy px-3 py-1.5 text-sm font-medium text-ivory transition-colors hover:bg-charcoal disabled:opacity-50"
        >
          {generating ? "Generating..." : latestDraft ? "Regenerate" : "Generate draft"}
        </button>
      </div>
      {genError && <p className="mt-2 text-sm text-danger">{genError}</p>}

      {latestDraft && (
        <div className="mt-4 space-y-3 border-t border-stone pt-4">
          <div className="grid grid-cols-1 gap-1 text-xs text-navy/50 sm:grid-cols-2">
            <span>From: {deliveryConfig?.fromAddress ?? "—"}</span>
            <span>Intended candidate: {application.email ?? "not on file"}</span>
            <span className="font-medium text-amber">Actual test recipient: {deliveryConfig?.testRecipient ?? "not configured"}</span>
            <span>Last saved: {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "—"}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Subject</label>
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setDirty(true);
              }}
              disabled={alreadySent}
              className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-navy/50">Body</label>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setDirty(true);
              }}
              disabled={alreadySent}
              rows={10}
              className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
            />
          </div>
          {(latestDraft.recruiter_edited || dirty) && !alreadySent && (
            <p className="text-xs text-gold-dark">
              {dirty ? "Unsaved edits" : "Edited"} — {latestDraft.ai_generated ? "originally AI-generated" : "manually authored"}
            </p>
          )}

          {!alreadySent && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={saveEdits}
                disabled={!dirty || saving}
                className="border border-stone px-3 py-1.5 text-sm font-medium text-navy hover:bg-ivory disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save draft"}
              </button>
              <button
                onClick={cancelEdits}
                disabled={!dirty}
                className="border border-stone px-3 py-1.5 text-sm font-medium text-navy hover:bg-ivory disabled:opacity-50"
              >
                Cancel
              </button>
              <button onClick={copyToClipboard} className="border border-stone px-3 py-1.5 text-sm font-medium text-navy hover:bg-ivory">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          <div className="border-t border-stone pt-3">
            {alreadySent || sendResult ? (
              <div className="space-y-1 border border-success/30 bg-success/5 p-3 text-sm">
                <p className="font-medium text-success">Sent in test mode</p>
                <p className="text-navy/70">
                  Actual test recipient: <span className="font-medium">{sendResult?.actualRecipient ?? deliveryConfig?.testRecipient}</span>
                </p>
                {latestDraft.sent_at && <p className="text-navy/50">Sent {new Date(latestDraft.sent_at).toLocaleString()}</p>}
                {sendResult?.messageId && <p className="text-navy/50">Message ID: {sendResult.messageId}</p>}
                <button onClick={sendAnother} className="mt-2 border border-stone px-3 py-1.5 text-xs font-medium text-navy hover:bg-ivory">
                  Send another test
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 text-sm text-navy/80">
                    <input
                      type="checkbox"
                      checked={reviewedProfile}
                      onChange={(e) => setReviewedProfile(e.target.checked)}
                      className="mt-0.5"
                    />
                    I confirm I reviewed this candidate&apos;s profile and evaluation.
                  </label>
                  <label className="flex items-start gap-2 text-sm text-navy/80">
                    <input
                      type="checkbox"
                      checked={reviewedEmail}
                      onChange={(e) => setReviewedEmail(e.target.checked)}
                      className="mt-0.5"
                    />
                    I confirm I reviewed this email draft.
                  </label>
                </div>

                {!confirmingSend ? (
                  <button
                    onClick={() => setConfirmingSend(true)}
                    disabled={!canSend}
                    className="mt-3 w-full border border-navy bg-navy px-4 py-2 text-sm font-medium text-ivory hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send test email
                  </button>
                ) : (
                  <div className="mt-3 space-y-2 border border-gold bg-gold/5 p-4">
                    <p className="text-sm font-semibold text-navy">Test email confirmation</p>
                    <p className="text-sm text-navy/80">
                      This message will be sent to <span className="font-medium">{deliveryConfig?.testRecipient}</span> for
                      review. It will not be delivered to the candidate.
                    </p>
                    <p className="text-sm text-navy/70">
                      Candidate: <span className="font-medium">{application.candidate_name ?? "Unnamed candidate"}</span>
                      <br />
                      Intended recipient: <span className="font-medium">{application.email ?? "not on file"}</span>
                      <br />
                      Decision:{" "}
                      <span className="font-medium">
                        {RECOMMENDATION_LABELS[application.final_recommendation ?? ""] ?? application.final_recommendation}
                      </span>
                      <br />
                      Actual recipient: <span className="font-medium">{deliveryConfig?.testRecipient}</span>
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={confirmSend}
                        disabled={sending}
                        className="border border-navy bg-navy px-3 py-1.5 text-sm font-medium text-ivory hover:bg-charcoal disabled:opacity-50"
                      >
                        {sending ? "Sending..." : "Confirm and send test email"}
                      </button>
                      <button
                        onClick={() => setConfirmingSend(false)}
                        disabled={sending}
                        className="border border-stone px-3 py-1.5 text-sm font-medium text-navy hover:bg-ivory"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {sendError && <p className="mt-2 text-sm text-danger">{sendError}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
