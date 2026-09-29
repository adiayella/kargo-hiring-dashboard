import { NextResponse } from "next/server";
import { getDeliveryMode } from "@/lib/emailDelivery";

// Exposes only non-secret delivery config to the client (mode, the test
// recipient address, the from address) — never the Resend API key.
// Must never be statically optimized: this reflects live env vars, and a
// build-time snapshot of "test mode" would be a real safety hazard if the
// env var changed after build without a redeploy.
export const dynamic = "force-dynamic";

export async function GET() {
  const mode = getDeliveryMode();
  return NextResponse.json({
    mode,
    testRecipient: mode === "test" ? process.env.TEST_EMAIL_RECIPIENT ?? null : null,
    fromAddress: process.env.RESEND_FROM_EMAIL ?? null,
  });
}
