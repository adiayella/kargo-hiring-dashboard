"use client";

import { useRef, useState } from "react";

export function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [role, setRole] = useState<"PM" | "SPM">("PM");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("role", role);
      const res = await fetch("/api/applications", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setStatus("idle");
      onUploaded();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-stone bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1 space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wide text-navy/50">CV file (PDF or DOCX)</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone bg-ivory/40 px-3 py-2 text-sm text-navy/60 transition-colors hover:border-gold hover:bg-gold/5">
            <svg className="h-4 w-4 shrink-0 text-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3"
              />
            </svg>
            <span className="truncate">{file ? file.name : "Choose a CV to upload"}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wide text-navy/50">Role applied for</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "PM" | "SPM")}
            className="rounded-lg border border-stone bg-white px-3 py-2 text-sm text-navy transition-colors focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!file || status === "uploading"}
          className="rounded-lg border border-navy bg-navy px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "uploading" ? "Evaluating..." : "Upload & evaluate"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </form>
  );
}
