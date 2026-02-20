import { generateText, tool, type CoreMessage, type Tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { getDb, products as productsTable } from '@ailms/db';
import { searchProduct, formatSearchResults } from './tools.js';

const SALES_ENABLEMENT_SYSTEM_PROMPT = `You are the VP of Product Marketing at this company. You have deep, authoritative knowledge of every product and feature in the portfolio.

Your role is to help sales representatives understand our products so they can close deals confidently.

Guidelines:
- Answer in a direct, confident, business-oriented tone — like a seasoned VP talking to their sales team
- When comparing products or features, be clear about differentiation and competitive advantages
- Always ground your answers in the actual product documentation retrieved by your tools
- If information spans multiple products, synthesize it into a cohesive narrative
- Flag gaps if a topic isn't covered in the available documentation
- Keep answers concise but complete — sales reps need to act fast

You have access to the full product knowledge base through specialized search tools. Use them to retrieve the most relevant information before answering.`;

export type OrchestratorMessage = CoreMessage;

export type OrchestratorResult = {
  text: string;
  toolCallCount: number;
  finishReason: string;
};

/**
 * Build the dynamic tool list from the products table.
 * Each product gets a `search_<product_name>` tool that queries its vector namespace.
 *
 * New products automatically appear as tools — no code changes required.
 */
async function buildProductTools() {
  const db = getDb();
  const allProducts = await db.select().from(productsTable);

  if (allProducts.length === 0) {
    console.warn('[Orchestrator] No products found in database — tools list is empty');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, Tool<any, any>> = {};

  for (const product of allProducts) {
    const toolName = `search_${product.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

    tools[toolName] = tool({
      description: `Search the knowledge base for information about ${product.name}. ${product.description}. Use this tool when the user asks about ${product.name} features, pricing, use cases, or competitive positioning.`,
      parameters: z.object({
        query: z.string().describe(`The specific question or topic to search for within ${product.name} documentation`),
      }),
      execute: async ({ query }) => {
        const results = await searchProduct(product.id, query);
        return formatSearchResults(results, product.name);
      },
    });
  }

  return tools;
}

/**
 * Main orchestrator entry point.
 * Loads all product tools dynamically, then calls Claude with the user's message.
 */
export async function runOrchestrator(
  messages: OrchestratorMessage[],
  options: { maxSteps?: number } = {},
): Promise<OrchestratorResult> {
  const tools = await buildProductTools();
  const maxSteps = options.maxSteps ?? 5;

  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system: SALES_ENABLEMENT_SYSTEM_PROMPT,
    messages,
    tools,
    maxSteps,
  });

  const toolCallCount = result.steps.reduce(
    (count, step) => count + (step.toolCalls?.length ?? 0),
    0,
  );

  return {
    text: result.text,
    toolCallCount,
    finishReason: result.finishReason,
  };
}

/**
 * Convenience wrapper for a single user question (no conversation history).
 */
export async function askOrchestrator(userMessage: string): Promise<string> {
  const result = await runOrchestrator([
    { role: 'user', content: userMessage },
  ]);
  return result.text;
}
