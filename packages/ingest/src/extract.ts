import { readFile } from 'fs/promises';
import path from 'path';

export type ExtractResult = {
  text: string;
  pageCount?: number;
  filename: string;
};

/**
 * Extract plain text from a PDF or DOCX buffer.
 * Returns the full text and optional page count.
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<ExtractResult> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.pdf') {
    return extractPdf(buffer, filename);
  }

  if (ext === '.docx' || ext === '.doc') {
    return extractDocx(buffer, filename);
  }

  if (ext === '.txt' || ext === '.md') {
    return {
      text: buffer.toString('utf-8'),
      filename,
    };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

async function extractPdf(buffer: Buffer, filename: string): Promise<ExtractResult> {
  // Dynamic import to avoid issues with pdf-parse's global side effects
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pageCount: data.numpages,
    filename,
  };
}

async function extractDocx(buffer: Buffer, filename: string): Promise<ExtractResult> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    filename,
  };
}

/**
 * Convenience wrapper: read a local file and extract its text.
 */
export async function extractFromFile(filePath: string): Promise<ExtractResult> {
  const buffer = await readFile(filePath);
  return extractText(buffer, path.basename(filePath));
}
