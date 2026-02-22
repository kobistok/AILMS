import './env.js'; // must be first — loads .env before any other imports
import { App, LogLevel } from '@slack/bolt';
import { registerMessageHandlers } from './handlers/messages.js';
import { registerMentionHandlers } from './handlers/mentions.js';
import { serve as inngestServe } from 'inngest/express';
import { inngest, ingestDocumentFn } from '@ailms/ai';
import express from 'express';

// ─── Slack Bolt app ───────────────────────────────────────────────────────────
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: process.env.SLACK_SOCKET_MODE === 'true',
  appToken: process.env.SLACK_APP_TOKEN,
  logLevel: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
  // HTTP mode port (Railway)
  port: Number(process.env.SLACK_BOT_PORT ?? 3001),
});

// Register event handlers
registerMessageHandlers(app);
registerMentionHandlers(app);

// ─── Inngest HTTP endpoint ────────────────────────────────────────────────────
// Inngest needs its own Express route alongside Bolt
const expressApp = express();
expressApp.use(express.json());

expressApp.use(
  '/api/inngest',
  inngestServe({ client: inngest, functions: [ingestDocumentFn] }),
);

const INNGEST_PORT = Number(process.env.INNGEST_PORT ?? 3002);
expressApp.listen(INNGEST_PORT, () => {
  console.log(`[Inngest] Listening on port ${INNGEST_PORT}`);
});

// ─── Start ────────────────────────────────────────────────────────────────────
(async () => {
  await app.start();
  console.log(`[Slack Bot] Running in ${process.env.SLACK_SOCKET_MODE === 'true' ? 'socket' : 'HTTP'} mode`);
})();
