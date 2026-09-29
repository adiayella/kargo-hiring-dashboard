"use client";

import { useEffect, useState } from "react";

export function useEmailDeliveryConfig() {
  const [config, setConfig] = useState<{ mode: "test" | "production"; testRecipient: string | null; fromAddress: string | null } | null>(
    null
  );
  useEffect(() => {
    fetch("/api/config/email-delivery")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);
  return config;
}

export function TestModeBadge({ className = "" }: { className?: string }) {
  const config = useEmailDeliveryConfig();
  if (!config || config.mode !== "test") return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-amber/40 bg-amber/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber ${className}`}
      title={`All emails are redirected to ${config.testRecipient ?? "the configured test recipient"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
      Test mode
    </span>
  );
}
