# Auto Bookmark

Save any web page, post on X, or YouTube video with one click. AI reads it, writes a summary,
and files it under a category, creating new categories as your interests change. Search your
library by describing what you remember ("the video about sourdough starters from last spring").

- `web/`: Next.js 16 app (library, search, categories, API), deployable to Vercel
- `web/supabase/`: Supabase config for local development
- `extension/`: Chrome/Edge/Brave/Arc extension (Manifest V3, no build step)

[Clerk](https://clerk.com) handles sign-in (Google, email). Supabase provides the database (Postgres
with pgvector).
The Next.js server handles saving, AI processing and search, so there is no other backend.

## Local development

Requirements: Node 20+, pnpm, Docker (for the local Supabase stack).

```bash
cd web
pnpm install
pnpm supabase start                  # local Supabase: API :54321, Postgres :54322, Studio :54323
cp .env.example .env.local           # defaults match the local stack; add OPENROUTER_API_KEY
pnpm db:migrate
pnpm dev                             # http://localhost:3000
```

Sign-in uses the Clerk development instance. Its keys live in `web/.env.local`; to restore them, run
`pnpm dlx clerk@latest env pull` from `web/`. Google sign-in works in development without extra setup.

## Deploying (Clerk + Supabase + Vercel)

1. **Supabase**: create a project at [supabase.com](https://supabase.com).
2. **Clerk**: in the [Clerk dashboard](https://dashboard.clerk.com), create a production instance
   for your domain (or run `pnpm dlx clerk@latest deploy`). Production Google sign-in needs your own
   Google OAuth client; Clerk's dashboard walks through it.
3. **Tables**: from `web/`, run `DIRECT_URL="<session pooler string>" pnpm db:migrate`
   (Supabase dashboard, Connect, *Session pooler*, port 5432).
4. **Vercel**: import the repo and set **Root Directory** to `web`. Add these environment variables:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk dashboard, API keys (production instance) |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-in`, `/sign-up` |
   | `DATABASE_URL` | Supabase, Connect, *Transaction pooler* string (port 6543) |
   | `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |

   The Vercel Supabase integration's `POSTGRES_URL` is used when `DATABASE_URL` is absent.
5. In Clerk, add your Vercel domain to the production instance's allowed origins if Clerk asks.
6. In the extension's options, set the app address to your Vercel URL and connect again.

### AI settings

AI runs through [OpenRouter](https://openrouter.ai) by default, using `openai/gpt-5.4-mini` for
summaries, categories and search, and `openai/text-embedding-3-small` for search vectors. Override
them with `AI_MODEL` and `AI_EMBEDDING_MODEL` (any OpenRouter model id; the embedding model must
return 1536 dimensions). The OpenRouter account needs credit for paid models.

To call a provider directly instead, set `AI_PROVIDER` to `openai` (`OPENAI_API_KEY`) or `google`
(`GOOGLE_GENERATIVE_AI_API_KEY`).

Embeddings are stored as 1536-dimension vectors. If you switch embedding provider after saving
bookmarks, use **Reprocess** on items (or re-save them) so search vectors stay comparable.

### Security

The server connects to Postgres directly and scopes every query to the signed-in Clerk user. Row-level
security is enabled on every table with no policies, so the public Supabase Data API can't read or
write any of them.

## Browser extension

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and pick the
   `extension/` folder.
2. A sign-in tab opens. After signing in, the extension connects to your account automatically.
3. Pin the extension. Click it (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>) on any page.
   The popup saves the page and shows its summary, category and tags once the AI has filed it,
   with **Undo** if you didn't mean to. On a page you saved before, it shows that bookmark
   instead of saving again.
4. Search your library from the popup's search box; results open in a new tab.
5. The toolbar button shows ✓ on pages that are already in your library.
6. Save single posts from a feed on X, Instagram and Facebook. On X, each post gets a bookmark
   button next to Like and Share. On Instagram and Facebook, a **Save** button appears on the
   post under your mouse. You can also right-click a post and choose **Save this post to Auto
   Bookmark**. The post's own link, text, author and image are saved, not the whole feed.
   Instagram and Facebook change their markup often, so this is best effort. If a Facebook post's
   link can't be found, open the post (click its date) and save it from there.

Right-click a page or link to save it without opening the popup (a notification shows the
category). Select text first to keep it as a note.

The extension talks to the deployed app at `https://auto-bookmark.vercel.app` by default. To use a
local or other deployment, set the address in the extension's options (right-click the toolbar
button, then **Options**), then connect again. For local development that is `http://localhost:3000`.

## How it works

1. **Save**: the extension captures what's on screen: tweet text and author on X, a single post's text and images on Instagram and Facebook, title,
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
| `web/src/db/schema.ts` | Tables: `category`, `bookmark` (vector + tsvector), `api_token`; `user_id` is the Clerk user id |
| `web/src/proxy.ts`, `web/src/lib/session.ts` | Clerk middleware; session and extension-token checks |
| `web/src/lib/extract.ts` | URL normalization, safe fetching, page/X/YouTube extraction |
| `web/src/lib/ai.ts` | Prompts and models: analyze, classify, plan search, embed |
| `web/src/lib/pipeline.ts` | Background processing and re-categorization |
| `web/src/lib/search.ts` | Hybrid semantic + keyword search |
| `web/src/lib/actions.ts` | Server actions used by the UI |
| `web/src/app/api/*` | Routes used by the extension |
| `extension/popup.html`, `extension/popup.js` | Popup: save status and summary, undo, library search |
| `extension/posts.js` | Content script: per-post save buttons on X, Instagram and Facebook |
| `extension/background.js` | Saving and page capture, "already saved" badge, context menus, notifications |
