import type { App } from '@slack/bolt';
import { runOrchestrator } from '@ailms/ai';
import type { OrchestratorMessage } from '@ailms/ai';

// Conversation history keyed by DM channel ID
const dmHistory = new Map<string, OrchestratorMessage[]>();

export function registerMessageHandlers(app: App) {
  // Handle DMs — only respond to direct messages, not channel messages
  app.message(async ({ message, client, say }) => {
    // Ignore messages from bots, messages with subtypes (join/leave etc.), and channel messages
    if (
      'bot_id' in message ||
      ('subtype' in message && message.subtype) ||
      message.channel_type !== 'im'
    ) {
      return;
    }

    const userMessage = 'text' in message ? message.text ?? '' : '';
    if (!userMessage.trim()) return;

    // Typing indicator
    await client.reactions.add({
      channel: message.channel,
      timestamp: message.ts,
      name: 'thinking_face',
    });

    try {
      const history = dmHistory.get(message.channel) ?? [];
      history.push({ role: 'user', content: userMessage });

      // Keep last 20 messages to avoid token bloat
      const trimmedHistory = history.slice(-20);
      const result = await runOrchestrator(trimmedHistory);

      trimmedHistory.push({ role: 'assistant', content: result.text });
      dmHistory.set(message.channel, trimmedHistory);

      await say({
        text: result.text,
        blocks: ([
          {
            type: 'section',
            text: { type: 'mrkdwn', text: result.text },
          },
          ...(result.toolCallCount > 0
            ? [
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `_Searched ${result.toolCallCount} product knowledge base${result.toolCallCount > 1 ? 's' : ''}_`,
                    },
                  ],
                },
              ]
            : []),
        ] as any[]),
      });
    } catch (error) {
      console.error('[DM handler] Error:', error);
      await say({ text: 'Something went wrong. Please try again in a moment.' });
    } finally {
      await client.reactions
        .remove({ channel: message.channel, timestamp: message.ts, name: 'thinking_face' })
        .catch(() => {});
    }
  });
}
