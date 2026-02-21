/**
 * Synchronous ingestion — same logic as the Inngest job but runs inline.
 * Used by the web upload API route so it works without Inngest running locally.
 */
import { getDb, getSupabase, documents as documentsTable, chunks as chunksTable } from '@ailms/db';
import { eq } from 'drizzle-orm';
import { embedDocuments } from './embeddings.js';

export type IngestInput = {
  documentId: string;
  productId: string;
  storagePath: string;
  filename: string;
};

export async function ingestDocumentSync(input: IngestInput): Promise<{ chunkCount: number }> {
  const { documentId, productId, storagePath, filename } = input;
  const db = getDb();
  const supabase = getSupabase();

  await db.update(documentsTable).set({ status: 'processing' }).where(eq(documentsTable.id, documentId));

  try {
    // Download from Supabase Storage
    const { data, error } = await supabase.storage.from('documents').download(storagePath);
    if (error || !data) throw new Error(`Failed to download file: ${error?.message}`);

    const buffer = Buffer.from(await data.arrayBuffer());

    // Extract + chunk
    const { extractText } = await import('@ailms/ingest');
    const { chunkText } = await import('@ailms/ingest');
    const { text, pageCount } = await extractText(buffer, filename);
    const chunks = chunkText(text, filename, pageCount);

    // Embed
    const embeddings = await embedDocuments(chunks.map((c) => c.content));

    // Store
    const rows = chunks.map((chunk, i) => ({
      documentId,
      productId,
      content: chunk.content,
      embedding: embeddings[i],
      metadata: JSON.stringify(chunk.metadata),
    }));

    const BATCH = 100;
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.insert(chunksTable).values(rows.slice(i, i + BATCH));
    }

    await db.update(documentsTable).set({ status: 'completed' }).where(eq(documentsTable.id, documentId));

    return { chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(documentsTable).set({ status: 'failed', errorMessage: message }).where(eq(documentsTable.id, documentId));
    throw err;
  }
}
