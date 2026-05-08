# Sediba Aesthetic & Wellness Clinic

A premium client acquisition website for Sediba Aesthetic & Wellness Clinic — a full-stack app with appointment booking and an AI concierge named Sedi.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 → proxied at `/api`)
- `pnpm --filter @workspace/sediba-clinic run dev` — run the frontend (port 18944 → proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS v4 + Framer Motion + Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI GPT (via Replit AI Integrations proxy) — streaming SSE
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema (appointments, services, conversations, messages)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/routes/openai.ts` — Sedi AI assistant with system prompt + SSE streaming
- `artifacts/sediba-clinic/src/pages/` — Frontend pages (home, services, book, ai-assistant, about)
- `artifacts/sediba-clinic/src/index.css` — Brand palette and design tokens
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do not hand-edit)

## Architecture decisions

- Contract-first API: OpenAPI spec drives all codegen — never hand-write hooks or Zod schemas
- SSE streaming for AI chat: raw `fetch` with `ReadableStream`, not generated hooks
- Services prices stored as integer cents in DB; API divides by 100 and returns Rands
- Conversations/messages schema from OpenAI template libs (`lib/integrations-openai-ai-server/`)
- Google Fonts `@import url()` must be the very first line in `index.css` (PostCSS requirement)

## Product

- **Home** (`/`): Cinematic hero, treatment categories, Why Sediba differentiators, testimonials
- **Services** (`/services`): Full treatment menu by category with pricing (Rands) and booking links
- **Book** (`/book`): 3-step booking flow — Treatment → Date/Time (real availability) → Details → Confirm
- **AI Assistant** (`/ai-assistant`): Chat with Sedi, the AI concierge — streaming GPT responses
- **About** (`/about`): Clinic story, philosophy, team, location, contact

## Brand

- Palette: White `#FFFFFF`, Light Grey `#D4D4D4`, Warm Grey `#9B9B9B`, Dark Grey `#3C3C3C`, Black `#1A1A1A`, Natural Wood `#C4A882`
- Fonts: Playfair Display (serif headings) + Plus Jakarta Sans (body)
- Zero emojis anywhere in the UI

## User preferences

- No emojis in the UI
- Prices in South African Rands (R)
- Brand palette strictly followed — no new colours introduced

## Gotchas

- Do NOT run `pnpm run codegen` without verifying `lib/api-zod/src/index.ts` only contains `export * from "./generated/api";` — codegen can corrupt it
- Google Fonts `@import url()` must be first line in CSS (before `@import "tailwindcss"`)
- AI streaming uses raw fetch, not generated hooks
- The `PORT` env var is required by Vite config — only set in workflow context, not manual shell runs

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
