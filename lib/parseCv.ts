export async function extractTextFromFile(buffer: Buffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported file type: ${fileName}`);
}
