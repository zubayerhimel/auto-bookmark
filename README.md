# Auto Bookmark

Save any web page, post on X, or YouTube video with one click. AI reads it, writes a summary,
and files it under a category, creating new categories as your interests change. Search your
library by describing what you remember ("the video about sourdough starters from last spring").

- `web/`: Next.js 16 app (library, search, categories, API), deployable to Vercel
- `web/supabase/`: Supabase config for local development
- `extension/`: Chrome/Edge/Brave/Arc extension (Manifest V3, no build step)

Supabase provides Google sign-in (Supabase Auth) and the database (Postgres with pgvector).
The Next.js server handles saving, AI processing and search, so there is no other backend.

## Local development

Requirements: Node 20+, pnpm, Docker (for the local Supabase stack).

```bash
cd web
pnpm install
pnpm supabase start                  # local Supabase: API :54321, Postgres :54322, Studio :54323
cp .env.example .env.local           # defaults already match the local stack; add an AI key
pnpm db:migrate
pnpm dev                             # http://localhost:3000
```

To use Google sign-in locally, create a Google OAuth client (below) with the redirect URI
`http://127.0.0.1:54321/auth/v1/callback`, put `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in `web/supabase/.env`, then run
`pnpm supabase stop && pnpm supabase start`.

## Deploying (Supabase + Vercel)

1. **Supabase**: create a project at [supabase.com](https://supabase.com).
2. **Google OAuth**: in Google Cloud Console, go to APIs & Services, Credentials, *Create OAuth
   client ID* (Web application). Add the redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`. Then in Supabase, go to
   Authentication, Sign In / Providers, Google; enable it and paste the client ID and secret.
3. **Tables**: from `web/`, run `DIRECT_URL="<session pooler string>" pnpm db:migrate`
   (Supabase dashboard, Connect, *Session pooler*, port 5432).
4. **Vercel**: import the repo and set **Root Directory** to `web`. Add these environment variables:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase, Connect, Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings, API Keys, publishable key (the legacy `anon` key also works, as `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
   | `DATABASE_URL` | Supabase, Connect, *Transaction pooler* string (port 6543) |
   | `AI_PROVIDER` + `OPENAI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` | Your AI key |

   The Vercel Supabase integration fills in the Supabase variables automatically
   (`POSTGRES_URL` is used when `DATABASE_URL` is absent).
5. **Redirect URLs**: in Supabase, go to Authentication, URL Configuration. Set Site URL to
   `https://<your-app>.vercel.app` and add `https://<your-app>.vercel.app/**` to the redirect URLs.
6. In the extension's options, set the app address to your Vercel URL and connect again.

### AI settings

`AI_PROVIDER` is `openai` (default) or `google`. Optional overrides: `AI_MODEL` and
`AI_EMBEDDING_MODEL`. Defaults are `gpt-5.4-mini` + `text-embedding-3-small`, or
`gemini-3.5-flash` + `gemini-embedding-001`.

Embeddings are stored as 1536-dimension vectors. If you switch embedding provider after saving
bookmarks, use **Reprocess** on items (or re-save them) so search vectors stay comparable.

### Security

The server connects to Postgres directly. Row-level security is enabled on every table, so the
public Supabase Data API only exposes a signed-in user's own bookmarks and categories, and never
extension access keys.

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
| `web/src/db/schema.ts` | Tables and RLS policies: `category`, `bookmark` (vector + tsvector), `api_token` (users live in Supabase `auth.users`) |
| `web/src/lib/supabase/*`, `web/src/proxy.ts` | Supabase Auth clients and session refresh |
| `web/src/lib/extract.ts` | URL normalization, safe fetching, page/X/YouTube extraction |
| `web/src/lib/ai.ts` | Prompts and models: analyze, classify, plan search, embed |
| `web/src/lib/pipeline.ts` | Background processing and re-categorization |
| `web/src/lib/search.ts` | Hybrid semantic + keyword search |
| `web/src/lib/actions.ts` | Server actions used by the UI |
| `web/src/app/api/*` | Routes used by the extension |
| `extension/background.js` | Toolbar button, context menus, page capture, notifications |
