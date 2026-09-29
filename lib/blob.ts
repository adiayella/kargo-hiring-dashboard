import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Vercel Blob's public tier has no private/signed-URL mode, so the file lives at an
// unguessable UUID-prefixed URL rather than truly access-controlled storage.
//
// If BLOB_READ_WRITE_TOKEN isn't configured, CVs fall back to local disk under
// public/uploads for local development only — Next.js serves that folder as static
// files. Do not rely on this fallback in production; it doesn't survive redeploys
// on Vercel's ephemeral filesystem.
export async function uploadCvFile(file: File) {
  const key = `${crypto.randomUUID()}-${file.name}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`cvs/${key}`, file, {
      access: "public",
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, key), buffer);
  return { url: `/uploads/${key}`, pathname: key };
}
