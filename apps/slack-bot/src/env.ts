import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root (two levels up from apps/slack-bot)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
