/**
 * Voyage AI embeddings for RAG.
 * Model: voyage-3 (1024 dimensions, best-in-class retrieval quality)
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';

type VoyageResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
};

async function callVoyageApi(inputs: string[], inputType: 'query' | 'document'): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('Missing VOYAGE_API_KEY environment variable');

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: inputs,
      model: VOYAGE_MODEL,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI API error ${response.status}: ${error}`);
  }

  const data: VoyageResponse = await response.json() as VoyageResponse;
  // Preserve original order
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Embed a single query string (for retrieval at inference time).
 */
export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await callVoyageApi([query], 'query');
  return embedding;
}

/**
 * Embed multiple document chunks in a single batch call.
 * Voyage AI supports up to 128 inputs per request.
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 128;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await callVoyageApi(batch, 'document');
    results.push(...embeddings);
  }

  return results;
}
