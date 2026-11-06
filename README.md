# Auto Bookmark

Save any web page, post on X, or YouTube video with one click. AI reads it, writes a summary,
and files it under a category, creating new categories as your interests change. Search your
library by describing what you remember ("the video about sourdough starters from last spring").

- `web/`: Next.js 16 app (Google sign-in, library, search, categories, API)
- `extension/`: Chrome/Edge/Brave/Arc extension (Manifest V3, no build step)

## Setup

Requirements: Node 20+, pnpm, Docker.

```bash
docker compose up -d                 # Postgres 17 + pgvector on localhost:5433
cd web
cp .env.example .env.local           # then fill it in (see below)
pnpm install
pnpm db:migrate
pnpm dev                             # http://localhost:3000
```

### `.env.local`

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Default matches `docker-compose.yml`. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally, your domain in production. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console, APIs & Services, Credentials, *OAuth client ID* (Web application). Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`. |
| `AI_PROVIDER` | `openai` (default) or `google`. |
| `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` | Key for the chosen provider. |
| `AI_MODEL`, `AI_EMBEDDING_MODEL` | Optional overrides. Defaults: `gpt-5.4-mini` + `text-embedding-3-small`, or `gemini-3.5-flash` + `gemini-embedding-001`. |

Embeddings are stored as 1536-dimension vectors. If you switch embedding provider after saving
bookmarks, use **Reprocess** on items (or re-save them) so search vectors stay comparable.

## Browser extension

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and pick the
   `extension/` folder.
2. A tab opens at `http://localhost:3000/extension`. Sign in and press **Connect extension**.
3. Pin the extension. Click it (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>) on any page.
   The badge shows ✓ when saved; a notification shows the category once the AI has filed it.
   Right-click a link to save it without opening it. Select text first to keep it as a note.

If the app runs somewhere other than `localhost:3000`, set the address in the extension's
options (right-click the toolbar button, then **Options**), then connect again.

## How it works

1. **Save**: the extension captures what's on screen: tweet text and author on X, title,
   channel and description on YouTube, the full page HTML elsewhere (so paywalled or
   logged-in pages work). It posts this to `POST /api/bookmarks` with a per-browser access key.
   Links added in the web app are fetched server-side instead (with SSRF protection), using
   oEmbed for X and YouTube plus YouTube captions when available.
2. **Process** (in the background via `after()`): the AI writes a title, a 2–4 sentence summary,
   key points and tags, then chooses one of your existing categories or creates a new one.
   Text is embedded with pgvector and indexed for full-text search.
3. **Search**: longer questions are first turned into a search plan (topic, content type,
   category, date range). Results combine semantic similarity and keyword matches with
   reciprocal rank fusion, and matching words are highlighted.
4. **Categories**: AI-created categories appear and disappear as needed. You can create,
   rename, describe, merge, or delete them, move any bookmark manually (the AI won't override
   that choice), or re-file the whole library after changing categories.

### Code map

| Path | Purpose |
| --- | --- |
| `web/src/db/schema.ts` | Tables: auth, `category`, `bookmark` (vector + tsvector), `api_token` |
| `web/src/lib/extract.ts` | URL normalization, safe fetching, page/X/YouTube extraction |
| `web/src/lib/ai.ts` | Prompts and models: analyze, classify, plan search, embed |
| `web/src/lib/pipeline.ts` | Background processing and re-categorization |
| `web/src/lib/search.ts` | Hybrid semantic + keyword search |
| `web/src/lib/actions.ts` | Server actions used by the UI |
| `web/src/app/api/*` | Routes used by the extension |
| `extension/background.js` | Toolbar button, context menus, page capture, notifications |
