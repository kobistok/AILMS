/**
 * Synchronous ingestion — same logic as the Inngest job but runs inline.
 * Used by the web upload API route so it works without Inngest running locally.
 */
import { getDb, getSupabase, documents as documentsTable, chunks as chunksTable } from '@ailms/db';
import { eq } from 'drizzle-orm';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { embedDocuments } from './embeddings.js';

const VALID_CATEGORIES = [
  'product-spec',
  'pricing',
  'ideal-customer-profile',
  'battle-cards',
  'security-privacy',
] as const;

async function classifyDocument(text: string, filename: string): Promise<string> {
  const sample = text.slice(0, 4000);
  const { text: response } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    prompt: `Classify this document into one or more of the following categories based on its content.

Document filename: ${filename}

Content excerpt:
${sample}

Categories:
- product-spec: Product features, capabilities, technical specs, how the product works
- pricing: Pricing plans, tiers, cost structures, discounts, packages
- ideal-customer-profile: Target customers, buyer personas, use cases, who benefits from this product
- battle-cards: Competitive analysis, objection handling, comparisons vs competitors
- security-privacy: Security features, data privacy, compliance certifications (SOC2, GDPR, etc.)

Return ONLY a valid JSON array of applicable category IDs. Example: ["product-spec","pricing"]
If none apply, return: []`,
  });

  try {
    const parsed = JSON.parse(response.trim()) as unknown;
    if (!Array.isArray(parsed)) return '[]';
    const valid = (parsed as unknown[]).filter(
      (c): c is string => typeof c === 'string' && (VALID_CATEGORIES as readonly string[]).includes(c),
    );
    return JSON.stringify(valid);
  } catch {
    return '[]';
  }
}

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

    // Embed + classify in parallel
    const [embeddings, categories] = await Promise.all([
      embedDocuments(chunks.map((c) => c.content)),
      classifyDocument(text, filename),
    ]);

    // Store chunks
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

    await db.update(documentsTable)
      .set({ status: 'completed', categories })
      .where(eq(documentsTable.id, documentId));

    return { chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(documentsTable).set({ status: 'failed', errorMessage: message }).where(eq(documentsTable.id, documentId));
    throw err;
  }
}
