// pdf-parse bundles a very old, bundled pdf.js (v1.10.100) that rejects some
// otherwise-valid PDFs (e.g. certain ReportLab-generated files with a comment
// inside the trailer dictionary) with a misleading "bad XRef entry" error.
// pdfjs-dist is the actively-maintained upstream library and parses those
// same files correctly.
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n");
}

export async function extractTextFromFile(buffer: Buffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported file type: ${fileName}`);
}
