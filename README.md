# Arabic Vocab — Personalized Learning

A full-stack app for **personalized Arabic vocabulary learning** with AI-assisted
lessons, Anki `.apkg` import, spaced repetition, and **persistent progress
tracking**. It solves the problem of generic AI chats forgetting what you know:
every word, mastery score, mistake, lesson, setting, and AI-added word lives in
a PostgreSQL database so your learning continues consistently over time.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + hand-authored **shadcn/ui** components (Radix primitives)
- **PostgreSQL** + **Prisma 6**
- Lightweight **local auth** (bcrypt + `jose` JWT session cookie)
- **Provider-agnostic AI layer** — OpenAI-compatible by default, swappable; falls
  back to a deterministic offline engine when no key is set
- **Server-side `.apkg` parsing** via `adm-zip` + `sql.js` (pure-WASM SQLite, no
  native build required)

## Features

| Area | What it does |
|---|---|
| **Anki import** | Upload `.apkg`, auto-detect Arabic/English fields, preserve deck/tags/raw fields, review & correct before saving, dedupe, mark new words `NEW` |
| **Vocabulary DB** | Full lexical model: harakāt, type, root, verb forms, conjugations, plurals, gender forms, examples, notes, provenance, mastery state |
| **Spaced repetition** | Transparent SRS — new words surface soon, wrong words repeat, 3 correct recalls ⇒ `MASTERED`, missed mastered words downgrade |
| **Isolated quiz** | Active-recall typing, deterministic + AI grading, mastery updates, full morphology reveal |
| **Paragraph mode** | AI-generated passage from *your* mastered/weak/new words at a configurable ratio; submit a translation, get corrections, grammar notes, missed-word breakdowns, and a natural translation |
| **AI-introduced words** | The AI may weave in a few new words (mode-controlled). Missed ones are saved & scheduled; known ones are left out. Reviewable separately. |
| **Deep dive** | Per-word page with morphology, conjugation, same-root words, history, and external dictionary links (Wiktionary, Almaany, Quran Corpus, Lane's, Hans Wehr) |
| **Dashboard** | Counts, due-today, accuracy trend, status breakdown, most-missed, recently-mastered, deck coverage |
| **Settings** | Lesson composition, ratio, length, difficulty, harakāt mode, topic, AI-vocab mode, and behaviour flags |
| **Data** | Export JSON/CSV, reset progress, delete everything |

---

## Manual setup steps

You need **Node 18+** and a **PostgreSQL** database. Docker is the easiest way to
get Postgres; a `docker-compose.yml` is included.

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

**Option A — Docker (recommended):**

```bash
docker compose up -d
```

This starts Postgres 16 on `localhost:5432` with database `arabic_vocab`
(user `arabic`, password `arabic`) — matching the default `DATABASE_URL`.

> On Windows, make sure **Docker Desktop is running** first.

**Option B — existing Postgres:** create a database and update `DATABASE_URL`
in `.env` accordingly.

### 3. Configure environment variables

Copy the example and edit values:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (default works with Docker) |
| `AUTH_SECRET` | Session signing secret — set a long random string (`openssl rand -base64 32`) |
| `AI_PROVIDER` | `openai` (any OpenAI-compatible endpoint) or `mock` |
| `AI_API_KEY` | Your AI key. **Leave empty to run fully offline** (deterministic grading + offline passages) |
| `AI_BASE_URL` | API base, e.g. `https://api.openai.com/v1` |
| `AI_MODEL` | Model id, e.g. `gpt-4o-mini` |

### 4. Create the database schema

```bash
npm run db:push
```

(or `npm run db:migrate` to create a versioned migration.)

### 5. (Optional) Seed a demo account

```bash
npm run db:seed
```

Creates `demo@arabic.local` / `demo1234` with a few starter words.

### 6. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>, **register an account** (or log in with the demo
user), then:

### 7. Import your Anki decks

Go to **Import Deck → choose a `.apkg`**. Arabic/English fields are detected
automatically; correct any ambiguous rows, then **Import**.

> If your `.apkg` uses Anki's newest compressed format, re-export it from Anki
> with **“Support older Anki versions”** checked.

### 8. Configure your AI key (optional but recommended)

Set `AI_API_KEY` in `.env` and restart. Without it the app still works:
isolated quizzes grade deterministically and passages are stitched offline — but
AI gives natural passages, corrections, and richer feedback.

---

## Using a shared / remote database (multiple laptops)

To use the **same database from more than one computer**, host Postgres in the
cloud instead of locally. [Neon](https://neon.tech) is recommended (free tier,
serverless, great with Next.js); Supabase or Railway work too.

1. Create a free project → copy the connection string (looks like
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`).
2. Put it in `.env` as `DATABASE_URL` on **every** machine. Use the **same**
   `AUTH_SECRET` and `AI_API_KEY` on each machine too.
3. Create the schema once: `npm run db:push`.
4. On a second laptop: install Node, copy the project, `npm install`, create the
   same `.env`, then `npm run dev`. No `db:push` needed — the schema already exists.

### Moving your existing local data to the remote DB

Your local data lives in the Docker container `arabic-vocab-db`. Dump it, then
restore into the empty remote database (run these in Git Bash):

```bash
# 1. Dump everything from the local Docker Postgres
docker exec -t arabic-vocab-db pg_dump -U arabic --no-owner --no-acl arabic_vocab > backup.sql

# 2. Restore into the fresh remote DB (do this BEFORE db:push — the dump
#    creates the tables and data together, in the correct order).
docker run --rm -i postgres:16-alpine psql "PASTE_YOUR_REMOTE_CONNECTION_STRING" < backup.sql
```

Keep `backup.sql` until you've confirmed the remote has your words. Don't delete
the local Docker volume until then.

## How progress stays consistent

- **The database is the source of truth.** The AI is only ever *given* your
  mastered / weak / review / new words and settings — it never invents what you
  know. See `src/lib/ai/prompts.ts`.
- Mastery is mutated in exactly one place (`src/lib/review.ts`) so every mode
  updates progress identically.
- The SRS engine (`src/lib/srs.ts`) is a pure, testable function.

## Project layout

```
prisma/schema.prisma         # 11 models, all enums
src/lib/
  ai/                        # provider abstraction, structured prompts, grading
  anki/parser.ts             # .apkg → cards
  srs.ts                     # spaced repetition
  review.ts                  # single place mastery is updated
  lesson-builder.ts          # word selection per settings
  stats.ts                   # dashboard aggregation
src/app/
  (app)/                     # authenticated pages (dashboard, vocab, practice…)
  api/                       # route handlers
  login/ register/           # auth
src/components/              # UI + feature components
```

## Scripts

| Script | Action |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm run db:push` | Push schema to the database |
| `npm run db:migrate` | Create/apply a migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop & recreate (destructive) |

## Swapping the AI provider

Implement the `AIProvider` interface in `src/lib/ai/provider.ts` and return it
from `getAIProvider()`. Everything else (prompts, grading, lesson generation)
stays unchanged.
