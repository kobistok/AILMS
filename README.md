# AILMS — AI Sales Enablement LMS

Internal AI LMS where PMs upload product docs and sales reps get instant answers via a "VP of Product Marketing" AI persona.

## Architecture

```
Sales Rep → Slack Bot → Orchestrator (Claude claude-sonnet-4-6)
                              ↓
              [tool: search_product_x(query)]
              [tool: search_product_y(query)]   ← dynamic, from DB
                              ↓
              pgvector similarity search (Supabase)
                              ↓
              Synthesized answer in VP of Product Marketing voice
```

## Monorepo Structure

```
ailms/
├── apps/
│   ├── web/          # Next.js 15 — PM dashboard (upload docs, manage agents)
│   └── slack-bot/    # Slack Bolt — sales rep interface
├── packages/
│   ├── ai/           # Orchestrator, RAG tools, Voyage AI embeddings, Inngest jobs
│   ├── db/           # Drizzle schema, Supabase client, migrations
│   └── ingest/       # PDF/DOCX text extraction + chunking
```

## Quick Start

### 1. Install dependencies
```bash
pnpm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Fill in Supabase, Anthropic, Voyage AI, Slack credentials
```

### 3. Set up the database
Run the migration SQL in your Supabase project:
```
packages/db/migrations/0001_initial_schema.sql
```

### 4. Run in development
```bash
pnpm dev                          # all apps in parallel
pnpm --filter web dev             # web only
pnpm --filter slack-bot dev       # slack bot only
```

## Tech Stack

| Concern | Technology |
|---------|-----------|
| LLM | Claude claude-sonnet-4-6 (Anthropic) |
| Embeddings | Voyage AI `voyage-3` (1024 dims) |
| Database + Storage | Supabase (PostgreSQL + pgvector) |
| ORM | Drizzle ORM |
| Background Jobs | Inngest |
| Web Framework | Next.js 15 (App Router) |
| Slack | Slack Bolt for JS |
| Monorepo | Turborepo + pnpm |
| Deployment (web) | Vercel |
| Deployment (bot) | Railway |

## Adding a New Product

1. Upload a PDF or DOCX via the web dashboard at `/upload`
2. The Inngest job automatically extracts, chunks, embeds, and stores the content
3. The orchestrator picks up the new product as a tool on the next request — **zero code changes**

## Environment Variables

See `.env.example` for the full list. Key variables:

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — Supabase project
- `DATABASE_URL` — direct Postgres connection string
- `ANTHROPIC_API_KEY` — for Claude claude-sonnet-4-6
- `VOYAGE_API_KEY` — for embedding generation
- `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` + `SLACK_APP_TOKEN` — Slack app credentials
- `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` — Inngest project credentials
