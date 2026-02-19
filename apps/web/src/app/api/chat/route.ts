/**
 * POST /api/chat
 *
 * REST endpoint for ChatGPT Custom GPT Actions.
 * Receives a user message and returns the orchestrator's response.
 */
import { NextRequest, NextResponse } from 'next/server';
import { askOrchestrator } from '@ailms/ai';
import { z } from 'zod';

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  // Optional: pass conversation history for multi-turn
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown;
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { message, history = [] } = parsed.data;

    const messages = [
      ...history,
      { role: 'user' as const, content: message },
    ];

    const { runOrchestrator } = await import('@ailms/ai');
    const result = await runOrchestrator(messages);

    return NextResponse.json({
      response: result.text,
      toolCallCount: result.toolCallCount,
    });
  } catch (error) {
    console.error('[Chat API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// OpenAPI schema for ChatGPT Custom GPT Actions
export async function GET() {
  return NextResponse.json({
    openapi: '3.1.0',
    info: {
      title: 'AILMS Product Knowledge API',
      description: 'Query the AI product knowledge base',
      version: '1.0.0',
    },
    paths: {
      '/api/chat': {
        post: {
          operationId: 'askProductKnowledge',
          summary: 'Ask the AI about any product',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    message: { type: 'string', description: 'The sales question to answer' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'AI response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      response: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
