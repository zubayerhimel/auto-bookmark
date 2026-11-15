# Auto Bookmark

Save any web page, post on X, or YouTube video with one click. AI reads it, writes a summary,
and files it under a category, creating new categories as your interests change. Search your
library by describing what you remember ("the video about sourdough starters from last spring").
Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> on any page (or <kbd>/</kbd> outside the library) to search,
jump to a category or page, or paste a link to save it.

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
cp .env.example .env.local           # defaults match the local stack; set AI_KEY_SECRET
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
   | `AI_KEY_SECRET` | Any long random string (e.g. `openssl rand -hex 32`); encrypts users' AI keys. Changing it makes saved keys unreadable, so users must add them again |
   | `CRON_SECRET` | Any long random string (e.g. `openssl rand -hex 32`); protects the daily job |

   The Vercel Supabase integration's `POSTGRES_URL` is used when `DATABASE_URL` is absent.

   `web/vercel.json` runs the server in `sin1` (Singapore) to sit next to a Supabase project in
   `ap-southeast-1`. Every query is a round trip to the database, so if your project is elsewhere,
   change it to the [nearest Vercel region](https://vercel.com/docs/regions). It also schedules
   `/api/cron` once a day (03:30 UTC); Vercel sends `CRON_SECRET` with it, and without the variable
   the job refuses to run.
5. In Clerk, add your Vercel domain to the production instance's allowed origins if Clerk asks.
6. In the extension's options, set the app address to your Vercel URL and connect again.

### AI settings

Each user brings their own AI key on the **AI settings** page (`/settings`): OpenAI, Anthropic
(Claude), Google (Gemini, an AI Studio key), Groq or OpenRouter (any model). The key is checked with one tiny request, then
stored encrypted (AES-256-GCM with `AI_KEY_SECRET`) and used only for that user's bookmarks. It is
never sent back to the browser. Until a user adds a key, their links are saved and read but not
summarized; adding one processes everything that was waiting. Provider errors the user can act on
(rejected key, no credits, unknown model) are shown on the bookmark and in settings.

| Provider | Default chat model | Search vectors |
| --- | --- | --- |
| OpenAI | `gpt-5.4-mini` | `text-embedding-3-small` |
| Anthropic | `claude-haiku-5-5` | none: search matches keywords only |
| Google | `gemini-3.5-flash` | `gemini-embedding-001` (1536 dimensions) |
| Groq | `openai/gpt-oss-120b` | none: search matches keywords only |
| OpenRouter | `openai/gpt-5.4-mini` | `openai/text-embedding-3-small` |

Users can pick another chat model. Each bookmark records which embedding model made its vector, and
search only compares vectors from the user's current model. After switching provider, the library is
re-embedded in the background; until then, older bookmarks are found by keywords. Search's relevance
cutoffs (top of `web/src/lib/search.ts`) are tuned for `text-embedding-3-small`; other embedding
models may need different values.

To let users without a key share the server's own key (a private, self-hosted setup), set
`AI_USE_SERVER_KEY=true` plus `OPENROUTER_API_KEY` (or `AI_PROVIDER` = `openai`, `google`, `groq` or
`anthropic` with `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY` or `ANTHROPIC_API_KEY`).
`AI_MODEL` and `AI_EMBEDDING_MODEL` override that key's models. It's off by default, so a public
deployment never spends the operator's credits.

### Security

The server connects to Postgres directly and scopes every query to the signed-in Clerk user. Row-level
security is enabled on every table with no policies, so the public Supabase Data API can't read or
write any of them.

## Browser extension

1. Get the extension: click **Download extension (.zip)** on the app's **Browser extension** page
   (`/extension`) and unzip it, or use the `extension/` folder from this repo. The zip is built from
   `extension/` by `web/scripts/zip-extension.mjs` whenever `pnpm dev` or `pnpm build` runs, and
   served at `/auto-bookmark-extension.zip`.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and pick the
   folder that contains `manifest.json`.
3. A sign-in tab opens. After signing in, the extension connects to your account automatically.
4. Pin the extension. Click it (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>, <kbd>⌥</kbd>+<kbd>⇧</kbd>+<kbd>S</kbd> on a Mac) on any page.
   The popup saves the page and shows its summary, category and tags once the AI has filed it,
   with **Undo** if you didn't mean to. On a page you saved before, it shows that bookmark
   instead of saving again.
5. Search your library from the popup's search box; results open in a new tab.
6. The toolbar button shows ✓ on pages that are already in your library.
7. Save single posts from a feed on X, Instagram and Facebook. On X, each post gets a bookmark
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

## Importing bookmarks

**Import bookmarks** (`/import`) takes a browser's bookmark export (the HTML file Chrome, Edge,
Firefox, Safari, Brave and Arc all produce), a CSV export with a `url` column (Pocket, Raindrop,
Instapaper), or a text file of links. The file is parsed in the browser
(`web/src/lib/import-parse.ts`); only the links are sent, in chunks, so large exports with
embedded favicons are no problem.

- Folder names become tags (the browser's own root folders like "Bookmarks bar" are skipped), along
  with any tags in the export. The original save date is kept.
- Links already in the library are skipped and left untouched. Imported links stay off the
  reading list unless the source marks them unread (Pocket).
- One import adds at most 500 new links, newest first, to bound AI cost. Import the same file
  again to add the next batch.
- Each link is then fetched, summarized and filed like a new save. Processing runs in the background
  in batches of up to four minutes. If a batch is cut off (Vercel's function limit, a restart), the
  app resumes it the next time it notices bookmarks waiting with no job running.
- **Start over** at the bottom of the page deletes every bookmark, category and extension token
  (after typing "delete" to confirm). The Clerk account itself is kept.

## Saving from your phone

The web app is installable, and its manifest registers it as a share target
(`web/src/app/manifest.ts`), so saving works from any app's Share menu.

- **Android**: open the site in Chrome, sign in, and choose **Install app** (or **Add to Home
  screen**). **Auto Bookmark** then shows up in the share sheet.
- **iPhone / iPad**: iOS doesn't let web apps join the share sheet, so use a Shortcut: turn on
  **Show in Share Sheet**, add **URL Encode** on the Shortcut Input, then **Open URLs** with
  `https://<your-domain>/share?url=<encoded input>`. The **Extension** page shows the exact address.

`/share` accepts `url`, `text` and `title` and finds the link in whichever one holds it (many
Android apps put it inside `text`); other shared text, like a highlighted passage, becomes the
bookmark's note (`web/src/lib/share.ts`). Visits from another site only show a **Save** button
instead of saving on their own. If the link is already saved, the page shows it instead.

## Reader view

Every saved page keeps its text, with paragraphs, headings and lists, and **Read saved copy** on a
bookmark opens it as a clean reading page (`/library/<id>/read`). It's still there if the page
changes, goes behind a paywall, or disappears. **Refresh from the page** fetches it again; the new
text is kept only if it isn't much shorter than the saved copy, so a page the extension captured
while you were logged in isn't replaced by a sign-in wall. Pages saved before paragraphs were kept
show their text run together, with a prompt to refresh.

## Dead links

A daily job (`/api/cron`) checks each saved link about once a month (`web/src/lib/link-check.ts`).
Only a clear "gone" counts: a 404 or 410, or a domain that no longer exists. YouTube videos and X
posts are checked through oEmbed, since those sites answer normally even for removed posts. Sites
that block automated checks (403, rate limits) and Instagram or Facebook posts are left as they
were. A dead link gets a **Link dead** marker in the library, and its page offers the saved copy
and **Check again**. The same job also finishes any processing that was cut off.

To run the job by hand: `curl -H "Authorization: Bearer $CRON_SECRET" <app address>/api/cron`.

## How it works

1. **Save**: the extension captures what's on screen: tweet text and author on X, a single post's text and images on Instagram and Facebook, title,
   channel and description on YouTube, the full page HTML elsewhere (so paywalled or
   logged-in pages work). It posts this to `POST /api/bookmarks` with a per-browser access key.
   Links added in the web app are fetched server-side instead (with SSRF protection), using
   oEmbed for X and YouTube plus YouTube captions when available.
2. **Process** (in the background via `after()`): the AI writes a title, a 2–4 sentence summary,
   key points and tags, then chooses one of your existing categories or creates a new one.
   Text is embedded with pgvector and indexed for full-text search. On a bookmark's page you can
   add a note and edit its tags; tags you edit are kept when it's summarized again. Click any tag
   (or pick one on the **Tags** page, `/tags`) to list every bookmark carrying it. Star a bookmark
   from its card or page to keep it under **Favorites**.
3. **Search**: longer questions are first turned into a search plan (topic, content type,
   category, date range). Results combine semantic similarity and keyword matches with
   reciprocal rank fusion, and matching words are highlighted. Semantic matches must be close to
   the best match and under an absolute distance cutoff; keyword matches containing every word
   rank first, and partial ones are kept only if they're also related in meaning.
4. **Categories**: AI-created categories appear and disappear as needed. You can create,
   rename, describe, merge, or delete them, move any bookmark manually (the AI won't override
   that choice), or re-file the whole library after changing categories. **Select** in the library
   lets you move, mark read or unread, or delete many bookmarks at once (Shift-click selects a range).
   For a single card, right-click it (or use its **⋯** button) to favorite, mark read or unread,
   move or delete it without opening it.

### Code map

| Path | Purpose |
| --- | --- |
| `web/src/db/schema.ts` | Tables: `category`, `bookmark` (vector + tsvector), `api_token`, `ai_settings`; `user_id` is the Clerk user id |
| `web/src/proxy.ts`, `web/src/lib/session.ts` | Clerk middleware; session and extension-token checks |
| `web/src/lib/extract.ts` | URL normalization, safe fetching, page/X/YouTube extraction |
| `web/src/lib/ai.ts` | Prompts and models: analyze, classify, plan search, embed; provider error messages |
| `web/src/lib/ai-settings.ts`, `web/src/lib/secret-box.ts` | Each user's AI key: encrypted storage and lookup |
| `web/src/lib/pipeline.ts` | Background processing (claims each bookmark atomically; `drainPending` resumes waiting ones) and re-categorization |
| `web/src/lib/import-parse.ts`, `web/src/lib/import.ts` | Import: parsing exports in the browser; adding the links server-side |
| `web/src/lib/share.ts`, `web/src/app/(app)/share/page.tsx` | Share target: saving links shared from a phone |
| `web/src/lib/reader.ts`, `web/src/app/(app)/library/[id]/read/page.tsx` | Reader view of the saved copy |
| `web/src/lib/link-check.ts`, `web/src/app/api/cron/route.ts` | Daily dead-link checks and processing sweep |
| `web/src/lib/search.ts` | Hybrid semantic + keyword search |
| `web/src/lib/actions.ts` | Server actions used by the UI |
| `web/src/app/api/*` | Routes used by the extension |
| `extension/popup.html`, `extension/popup.js` | Popup: save status and summary, undo, library search |
| `extension/posts.js` | Content script: per-post save buttons on X, Instagram and Facebook |
| `extension/background.js` | Saving and page capture, "already saved" badge, context menus, notifications |
