"use client";

import { useState } from "react";

export function ResumePreview({
  candidateName,
  fileUrl,
  fileName,
  rawText,
}: {
  candidateName: string | null;
  fileUrl: string;
  fileName: string;
  rawText: string | null;
}) {
  const [showText, setShowText] = useState(false);
  const isPdf = fileName.toLowerCase().endsWith(".pdf");

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy/50">
          Resume — {candidateName ?? "Unnamed candidate"}
        </h2>
        <div className="flex items-center gap-3">
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-gold-dark hover:underline">
            Open original ↗
          </a>
          {!isPdf && rawText && (
            <button onClick={() => setShowText((v) => !v)} className="text-xs font-medium text-gold-dark hover:underline">
              {showText ? "Hide extracted text" : "Show extracted text"}
            </button>
          )}
        </div>
      </div>

      {isPdf ? (
        <div className="mt-3 border border-stone bg-white">
          <iframe src={fileUrl} title={`Resume preview for ${candidateName ?? "candidate"}`} className="h-[520px] w-full" />
        </div>
      ) : (
        <div className="mt-3 border border-stone bg-ivory/50 p-4 text-sm text-navy/70">
          <p>Visual preview isn&apos;t available for this file type (DOCX). Showing extracted text instead.</p>
          {rawText && !showText && (
            <button onClick={() => setShowText(true)} className="mt-2 text-xs font-medium text-gold-dark hover:underline">
              Show extracted text
            </button>
          )}
        </div>
      )}

      {!isPdf && showText && rawText && (
        <div className="mt-3 max-h-[500px] overflow-y-auto whitespace-pre-line border border-stone bg-white p-4 text-sm text-navy/80">
          {rawText}
        </div>
      )}
    </section>
  );
}
