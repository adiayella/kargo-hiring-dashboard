/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "mammoth"],
    // pdfjs-dist loads its worker file via a dynamically-computed path at
    // runtime, which Vercel's output file tracing can't detect statically —
    // without this, the worker file is silently missing from the deployed
    // serverless function bundle (works locally, fails only in production).
    outputFileTracingIncludes: {
      "/api/applications": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    },
  },
};

export default nextConfig;
