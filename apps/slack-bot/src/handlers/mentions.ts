import type { App } from '@slack/bolt';
import { runOrchestrator } from '@ailms/ai';
import type { OrchestratorMessage } from '@ailms/ai';
import { resolveOrgName } from './resolve-org.js';

// In-memory conversation history per Slack thread
// Key: threadTs (or channel for non-threaded messages)
const threadHistory = new Map<string, OrchestratorMessage[]>();

export function registerMentionHandlers(app: App) {
  app.event('app_mention', async ({ event, client, say }) => {
    const threadKey = event.thread_ts ?? event.ts;
    const userMessage = stripBotMention(event.text);

    if (!userMessage.trim()) return;

    // Show typing indicator
    await client.reactions.add({
      channel: event.channel,
      timestamp: event.ts,
      name: 'thinking_face',
    });

    try {
      const orgName = event.user ? await resolveOrgName(event.user, client) : null;

      // Build conversation history for this thread
      const history = threadHistory.get(threadKey) ?? [];
      history.push({ role: 'user', content: userMessage });

      const result = await runOrchestrator(history, { orgName });

      // Store assistant response in history
      history.push({ role: 'assistant', content: result.text });
      threadHistory.set(threadKey, history);

      // Reply in thread
      await say({
        text: result.text,
        thread_ts: event.thread_ts ?? event.ts,
        blocks: buildResponseBlocks(result.text, result.toolCallCount) as any[],
      });
    } catch (error) {
      console.error('[Mention handler] Error:', error);
      await say({
        text: 'Sorry, I ran into an issue. Please try again.',
        thread_ts: event.thread_ts ?? event.ts,
      });
    } finally {
      // Remove thinking indicator
      await client.reactions.remove({
        channel: event.channel,
        timestamp: event.ts,
        name: 'thinking_face',
      }).catch(() => {/* ignore if already removed */});
    }
  });
}

function stripBotMention(text: string): string {
  // Remove <@UXXXXXXX> mention pattern
  return text.replace(/<@[A-Z0-9]+>/g, '').trim();
}

function buildResponseBlocks(text: string, toolCallCount: number) {
  const blocks: object[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text },
    },
  ];

  if (toolCallCount > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Searched ${toolCallCount} product knowledge base${toolCallCount > 1 ? 's' : ''}_`,
        },
      ],
    });
  }

  return blocks;
}
