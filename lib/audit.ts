import { db } from "./db";

export type DecisionEventType =
  | "resume_uploaded"
  | "evaluation_generated"
  | "evaluation_failed"
  | "recommendation_produced"
  | "recruiter_reviewed"
  | "email_drafted"
  | "email_approved"
  | "email_sent"
  | "email_failed";

export async function logDecisionEvent(
  applicationId: string,
  eventType: DecisionEventType,
  payload: Record<string, unknown> = {}
) {
  await db.insert("decision_events", {
    application_id: applicationId,
    event_type: eventType,
    payload,
  });
}
