export type ChunkMetadata = {
  filename: string;
  pageNumber?: number;
  sectionTitle?: string;
  chunkIndex: number;
  totalChunks: number;
};

export type TextChunk = {
  content: string;
  metadata: ChunkMetadata;
};

const CHUNK_SIZE = 512;    // tokens
const CHUNK_OVERLAP = 128; // tokens

// Simple token estimator: ~4 chars per token (good enough for chunking)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text by detecting section headers (lines starting with # or all-caps).
 * Returns an array of { title, content } sections.
 */
function splitIntoSections(text: string): Array<{ title: string; content: string }> {
  const lines = text.split('\n');
  const sections: Array<{ title: string; content: string }> = [];
  let currentTitle = 'Introduction';
  let currentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeader =
      trimmed.startsWith('#') ||
      // Detect ALL-CAPS short lines as section headings
      (trimmed.length > 3 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed));

    if (isHeader && currentLines.length > 0) {
      sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
      currentLines = [];
      currentTitle = trimmed.replace(/^#+\s*/, '');
    } else if (isHeader) {
      currentTitle = trimmed.replace(/^#+\s*/, '');
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
  }

  return sections.filter((s) => s.content.length > 0);
}

/**
 * Sliding-window chunker.
 * Chunks a section's content into overlapping windows of ~CHUNK_SIZE tokens.
 */
function chunkSection(
  sectionContent: string,
  sectionTitle: string,
  filename: string,
  startChunkIndex: number,
): { chunks: string[]; nextIndex: number } {
  const words = sectionContent.split(/\s+/);
  const chunks: string[] = [];

  // Rough tokens-per-word ratio
  const tokensPerWord = estimateTokens(sectionContent) / (words.length || 1);
  const wordsPerChunk = Math.floor(CHUNK_SIZE / tokensPerWord);
  const overlapWords = Math.floor(CHUNK_OVERLAP / tokensPerWord);

  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunk = words.slice(start, end).join(' ');

    if (chunk.trim().length > 0) {
      // Prepend section title to every chunk so context is preserved
      chunks.push(`[${sectionTitle}]\n${chunk}`);
    }

    if (end >= words.length) break;
    start = end - overlapWords;
    if (start < 0) start = 0;
  }

  return { chunks, nextIndex: startChunkIndex + chunks.length };
}

/**
 * Main chunking function.
 * Takes extracted text and returns an array of TextChunks with metadata.
 */
export function chunkText(
  text: string,
  filename: string,
  pageCount?: number,
): TextChunk[] {
  const sections = splitIntoSections(text);
  const result: TextChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    if (estimateTokens(section.content) <= CHUNK_SIZE) {
      // Small section: keep as one chunk
      result.push({
        content: `[${section.title}]\n${section.content}`,
        metadata: {
          filename,
          sectionTitle: section.title,
          chunkIndex,
          totalChunks: -1, // patched after
        },
      });
      chunkIndex++;
    } else {
      // Large section: slide over it
      const { chunks, nextIndex } = chunkSection(
        section.content,
        section.title,
        filename,
        chunkIndex,
      );
      for (const chunk of chunks) {
        result.push({
          content: chunk,
          metadata: {
            filename,
            sectionTitle: section.title,
            chunkIndex,
            totalChunks: -1, // patched after
          },
        });
        chunkIndex++;
      }
      chunkIndex = nextIndex;
    }
  }

  // Patch totalChunks now that we know the final count
  const total = result.length;
  for (const chunk of result) {
    chunk.metadata.totalChunks = total;
  }

  return result;
}
