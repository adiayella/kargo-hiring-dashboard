# Kargo Hiring Dashboard

Founder-in-the-loop CV review for Kargo's PM and Senior PM roles. Scores, ranks,
explains, and pre-drafts — Arjun looks, decides, and clicks.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Neon Postgres, accessed via a direct connection (`pg`) — see [lib/db.ts](lib/db.ts)
- Vercel Blob for CV file storage (falls back to local disk under `public/uploads` if unconfigured — dev only)
- OpenAI for CV extraction, rubric scoring, rationale, and drafting — see [lib/ai.ts](lib/ai.ts)
- Resend for outbound email (founder-triggered only)

**No login/auth.** The dashboard is unauthenticated — anyone with the URL can view
candidate data and send email as Arjun. Fine for local-only use; add auth before
deploying this anywhere reachable by others.

## Setup

1. **Database** — create a Neon project, run [db/schema.sql](db/schema.sql) against it (Neon
   SQL editor or `psql`), then copy the pooled connection string (Connect button, `-pooler`
   host) into `DATABASE_URL`.
2. **File storage** — create a Vercel Blob store and copy its token into `BLOB_READ_WRITE_TOKEN`.
   Optional for local dev — without it, uploads are written to `public/uploads` instead.
3. **OpenAI** — create an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   and put it in `OPENAI_API_KEY`.
4. **Resend** — create an API key and a verified sending domain/address, put them in
   `RESEND_API_KEY` / `RESEND_FROM_EMAIL`.
5. Copy `.env.local.example` to `.env.local` and fill in the values above.
6. `npm install`
7. `npm run dev`

## Workflow

1. **Upload** — founder picks a CV (PDF/DOCX) and a role (PM/SPM) in the dashboard.
2. **Extract** — the file is stored in Vercel Blob; text is extracted server-side; OpenAI
   splits it into PII (name/email/phone/address, kept server-side) and anonymized
   experience data (roles, responsibilities, achievements, tools, metrics).
3. **Score** — the anonymized experience is scored against the rubric embedded verbatim in
   [lib/rubric.ts](lib/rubric.ts) (from `kargo_pm_hiring_rubric.md`): six weighted criteria,
   0–5 each, with an evidence citation per criterion. Missing evidence scores 0 and is
   labeled "not evidenced" — never inferred. The weighted total and band (`Reject` < 65,
   `Hold` 65–75, `Strong Pool` > 75) are computed in code from the model's per-criterion
   scores, not trusted from free-form model math.
4. **Draft** — OpenAI generates an interview brief and a role/band-appropriate draft email
   (invite / hold / reject), stored against the application. Nothing is sent automatically.
5. **Review & send** — the dashboard shows a ranked, filterable list (by role and band).
   Each row expands to show the six scores with evidence, the rationale, the interview
   brief, and an editable draft email with a one-click Send button, plus a free-form
   compose-and-send option for any message. Every send is an explicit founder click,
   logged to `emails_log`, and updates the application's status.

## Notes on the database layer

[lib/db.ts](lib/db.ts) talks to Neon over a plain `pg` connection pool — no Data API, no
JWT. (Neon's Data API was tried first but rejects every request without a signed JWT bearer
token, even on tables with RLS disabled; that requires wiring up an auth provider like Better
Auth, which is unnecessary complexity for a server-only backend with no client-side DB access.)
