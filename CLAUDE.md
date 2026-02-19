# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AILMS is a Turborepo monorepo. PMs upload PDFs/DOCX files; each product gets a vector namespace and an AI agent. Sales reps query all agents simultaneously through a "VP of Product Marketing" persona via Slack.

## Commands

```bash
pnpm install            # install all workspace dependencies
pnpm dev                # run all apps in parallel (turbo)
pnpm build              # build all packages/apps
pnpm typecheck          # TypeScript check across all packages
pnpm lint               # lint all packages

pnpm --filter web dev           # Next.js web app only
pnpm --filter slack-bot dev     # Slack bot only
pnpm --filter db migrate        # run database migrations
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema.ts` | Drizzle schema (products, documents, chunks) |
| `packages/db/migrations/0001_initial_schema.sql` | Supabase SQL — run this first |
| `packages/ai/src/orchestrator.ts` | Core agent — dynamically loads products as tools |
| `packages/ai/src/tools.ts` | `searchProduct()` — pgvector cosine search |
| `packages/ai/src/embeddings.ts` | Voyage AI `voyage-3` embedding calls |
| `packages/ai/src/inngest.ts` | Background job: download → extract → chunk → embed → store |
| `packages/ingest/src/extract.ts` | PDF/DOCX text extraction (pdf-parse, mammoth) |
| `packages/ingest/src/chunk.ts` | Sliding window chunker (512 tok / 128 overlap) |
| `apps/web/src/app/api/upload/route.ts` | Upload endpoint → Supabase Storage → triggers Inngest |
| `apps/web/src/app/api/chat/route.ts` | REST endpoint for ChatGPT Custom GPT Actions |
| `apps/web/src/app/api/inngest/route.ts` | Inngest webhook handler |
| `apps/slack-bot/src/app.ts` | Slack Bolt app entry point |
| `apps/slack-bot/src/handlers/mentions.ts` | Handles @bot mentions in channels |
| `apps/slack-bot/src/handlers/messages.ts` | Handles DMs |

## Architecture Decisions

- **product_id as namespace**: Every vector search is filtered by `product_id`. New products auto-appear as tools.
- **Voyage AI voyage-3**: 1024-dimension embeddings. The `chunks.embedding` column is `VECTOR(1024)`.
- **Dynamic tools**: `orchestrator.ts` queries the `products` table at runtime to build the tool list — no code changes needed when adding products.
- **Inngest**: All ingestion runs async. The upload API just stores the file and fires an event.
- **Supabase Storage bucket**: `documents` — files are stored at `{productId}/{timestamp}-{filename}`.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- `ANTHROPIC_API_KEY` (Claude claude-sonnet-4-6)
- `VOYAGE_API_KEY` (Voyage AI embeddings)
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

## Database Setup

Run `packages/db/migrations/0001_initial_schema.sql` in Supabase SQL editor. This:
- Enables pgvector
- Creates products, documents, chunks tables
- Creates the `match_chunks` RPC function (cosine similarity search)
- Sets up RLS policies
