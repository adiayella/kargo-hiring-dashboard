import { NextRequest, NextResponse } from "next/server";
import { db, eq } from "@/lib/db";
import { uploadCvFile } from "@/lib/blob";
import { extractTextFromFile } from "@/lib/parseCv";
import { extractCandidateData } from "@/lib/ai";
import { runEvaluationPipeline } from "@/lib/evaluationPipeline";
import { logDecisionEvent } from "@/lib/audit";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role"); // PM | SPM
  const band = searchParams.get("band"); // Reject | Hold | Strong Pool

  const params: Record<string, string | ReturnType<typeof eq> | undefined> = {
    order: "weighted_total.desc.nullslast",
  };
  if (role === "PM" || role === "SPM") params.role = eq(role);
  if (band === "Reject" || band === "Hold" || band === "Strong Pool") params.band = eq(band);

  const applications = await db.select("applications", params);
  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  const role = formData.get("role");

  if (!(file instanceof File) || (role !== "PM" && role !== "SPM")) {
    return NextResponse.json({ error: "A CV file and a role (PM or SPM) are required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 10MB" }, { status: 400 });
  }
  const lowerName = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return NextResponse.json({ error: "Only PDF and DOCX files are accepted" }, { status: 400 });
  }

  // Create the application row FIRST (right after upload), before any text
  // extraction or AI call. This guarantees that a candidate always shows up in
  // the queue — even a corrupt/unparseable PDF lands as a visible
  // "Evaluation failed" entry instead of silently disappearing.
  let applicationId: string | undefined;

  try {
    const { url: fileUrl } = await uploadCvFile(file);

    const application = await db.insert<{ id: string }>("applications", {
      candidate_name: null,
      email: null,
      phone: null,
      role,
      file_url: fileUrl,
      file_name: file.name,
      status: "processing",
    });
    applicationId = application.id;

    await logDecisionEvent(application.id, "resume_uploaded", { fileName: file.name, role });

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromFile(buffer, file.name);
    const { pii, experience } = await extractCandidateData(rawText);

    await db.update("applications", { id: eq(application.id) }, {
      candidate_name: pii.name,
      email: pii.email,
      phone: pii.phone,
    });

    await db.insert("candidates", {
      application_id: application.id,
      extracted_json: experience,
      raw_text: rawText,
    });

    const { evaluation } = await runEvaluationPipeline({
      applicationId: application.id,
      role,
      experience,
    });

    await db.update("applications", { id: eq(application.id) }, { status: "scored" });

    return NextResponse.json(
      { applicationId: application.id, overallScore: evaluation.overallScore, recommendation: evaluation.aiRecommendation },
      { status: 201 }
    );
  } catch (err) {
    // Log only the error message, never file contents or extracted resume data.
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Application pipeline failed for application", applicationId ?? "(not yet created)", "-", message);
    if (applicationId) {
      await db.update("applications", { id: eq(applicationId) }, { status: "evaluation_failed" }).catch(() => {});
      await logDecisionEvent(applicationId, "evaluation_failed", { error: message }).catch(() => {});
      return NextResponse.json({ error: `Failed to process application: ${message}`, applicationId }, { status: 500 });
    }
    return NextResponse.json({ error: `Failed to process application: ${message}` }, { status: 500 });
  }
}
