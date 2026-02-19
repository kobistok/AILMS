import { Inngest } from 'inngest';
import { getDb, getSupabase, documents as documentsTable, chunks as chunksTable } from '@ailms/db';
import { eq } from 'drizzle-orm';
import { embedDocuments } from './embeddings.js';

export const inngest = new Inngest({ id: 'ailms' });

type IngestDocumentEvent = {
  data: {
    documentId: string;
    productId: string;
    storagePath: string;
    filename: string;
  };
};

/**
 * Inngest function: triggered when a document is uploaded.
 * Downloads from Supabase Storage → extracts text → chunks → embeds → stores.
 */
export const ingestDocumentFn = inngest.createFunction(
  {
    id: 'ingest-document',
    name: 'Ingest Document',
    retries: 3,
  },
  { event: 'ailms/document.uploaded' },
  async ({ event, step }) => {
    const { documentId, productId, storagePath, filename } =
      (event as IngestDocumentEvent).data;

    const db = getDb();
    const supabase = getSupabase();

    // 1. Mark as processing
    await step.run('mark-processing', async () => {
      await db
        .update(documentsTable)
        .set({ status: 'processing' })
        .where(eq(documentsTable.id, documentId));
    });

    // 2. Download from Supabase Storage
    const fileBuffer = await step.run('download-file', async () => {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(storagePath);

      if (error || !data) {
        throw new Error(`Failed to download file: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    });

    // 3. Extract text + chunk
    const textChunks = await step.run('extract-and-chunk', async () => {
      const { extractText } = await import('@ailms/ingest');
      const { chunkText } = await import('@ailms/ingest');

      const buffer = Buffer.from(fileBuffer, 'base64');
      const { text, pageCount } = await extractText(buffer, filename);
      return chunkText(text, filename, pageCount);
    });

    // 4. Embed all chunks (in batches via Voyage AI)
    const embeddings = await step.run('embed-chunks', async () => {
      const contents = textChunks.map((c) => c.content);
      return embedDocuments(contents);
    });

    // 5. Store chunks + embeddings in DB
    await step.run('store-chunks', async () => {
      const rows = textChunks.map((chunk, i) => ({
        documentId,
        productId,
        content: chunk.content,
        embedding: embeddings[i],
        metadata: JSON.stringify(chunk.metadata),
      }));

      // Insert in batches of 100
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        await db.insert(chunksTable).values(rows.slice(i, i + BATCH));
      }

      return { chunkCount: rows.length };
    });

    // 6. Mark as completed
    await step.run('mark-completed', async () => {
      await db
        .update(documentsTable)
        .set({ status: 'completed' })
        .where(eq(documentsTable.id, documentId));
    });

    return { documentId, chunkCount: textChunks.length };
  },
);

/**
 * Send the document.uploaded event to trigger ingestion.
 */
export async function triggerDocumentIngestion(data: IngestDocumentEvent['data']) {
  await inngest.send({
    name: 'ailms/document.uploaded',
    data,
  });
}
