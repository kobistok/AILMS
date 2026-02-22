import dotenv from 'dotenv';
import path from 'path';

// process.cwd() = apps/slack-bot when run via pnpm --filter slack-bot
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
