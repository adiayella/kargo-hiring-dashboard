"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteCandidate({ applicationId, candidateName }: { applicationId: string; candidateName: string | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = candidateName ?? "this candidate";
  const canDelete = typedName.trim().toLowerCase() === label.toLowerCase();

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete");
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <section className="border border-danger/30 bg-danger/5 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-danger">Danger zone</h2>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
        >
          Delete this test candidate
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-navy/70">
            This permanently deletes {label}&apos;s application, evaluation, drafts, and resume file. Type{" "}
            <span className="font-medium text-navy">{label}</span> to confirm.
          </p>
          <input
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className="w-full border border-stone bg-white px-2.5 py-1.5 text-sm focus:border-danger focus:outline-none focus:ring-1 focus:ring-danger"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={doDelete}
              disabled={!canDelete || deleting}
              className="border border-danger bg-danger px-3 py-1.5 text-sm font-medium text-ivory hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? "Deleting..." : "Permanently delete"}
            </button>
            <button
              onClick={() => {
                setConfirming(false);
                setTypedName("");
              }}
              disabled={deleting}
              className="border border-stone px-3 py-1.5 text-sm font-medium text-navy hover:bg-ivory"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
