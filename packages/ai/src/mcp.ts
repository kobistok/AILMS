/**
 * MCP (Model Context Protocol) server.
 * Exposes the same search_product tool to Claude Desktop.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getDb, products as productsTable } from '@ailms/db';
import { searchProduct, formatSearchResults } from './tools.js';

const server = new Server(
  { name: 'ailms-mcp', version: '0.0.1' },
  { capabilities: { tools: {} } },
);

// List available tools dynamically from DB
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const db = getDb();
  const allProducts = await db.select().from(productsTable);

  return {
    tools: allProducts.map((product) => ({
      name: `search_${product.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
      description: `Search knowledge about ${product.name}: ${product.description}`,
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: `Question or topic to search in ${product.name} docs`,
          },
        },
        required: ['query'],
      },
    })),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const db = getDb();
  const allProducts = await db.select().from(productsTable);

  const toolName = request.params.name;
  const product = allProducts.find(
    (p) => `search_${p.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}` === toolName,
  );

  if (!product) {
    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  }

  const query = (request.params.arguments as { query: string }).query;
  const results = await searchProduct(product.id, query);
  const formatted = formatSearchResults(results, product.name);

  return {
    content: [{ type: 'text' as const, text: formatted }],
  };
});

export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] AILMS server running on stdio');
}
