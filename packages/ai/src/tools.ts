import { getSupabase } from '@ailms/db';
import { embedQuery } from './embeddings.js';

export type SearchResult = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

/**
 * Performs a cosine similarity search against the chunks table,
 * filtered by product_id (the namespace).
 *
 * Uses the `match_chunks` Postgres RPC function defined in the migration.
 */
export async function searchProduct(
  productId: string,
  query: string,
  matchCount = 5,
  matchThreshold = 0.3,
): Promise<SearchResult[]> {
  const supabase = getSupabase();
  const embedding = await embedQuery(query);

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    product_id_filter: productId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });

  if (error) {
    throw new Error(`Vector search failed for product ${productId}: ${error.message}`);
  }

  return (data ?? []) as SearchResult[];
}

/**
 * Format search results into a readable context block for the LLM.
 */
export function formatSearchResults(results: SearchResult[], productName: string): string {
  if (results.length === 0) {
    return `No relevant information found for ${productName}.`;
  }

  const lines = [`=== Knowledge from ${productName} ===`];
  for (const result of results) {
    const meta = result.metadata as { filename?: string; sectionTitle?: string };
    const source = [meta.filename, meta.sectionTitle].filter(Boolean).join(' › ');
    lines.push(`\n[Source: ${source || 'unknown'}] (similarity: ${result.similarity.toFixed(2)})`);
    lines.push(result.content);
  }
  return lines.join('\n');
}
