import { serve } from 'inngest/next';
import { inngest, ingestDocumentFn } from '@ailms/ai';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingestDocumentFn],
});
