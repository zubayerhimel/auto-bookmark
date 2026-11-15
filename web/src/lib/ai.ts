import "server-only";
import {
  APICallError,
  embed,
  generateText,
  Output,
  RetryError,
  defaultSettingsMiddleware,
  streamText,
  wrapLanguageModel,
  type EmbeddingModel,
  type LanguageModel,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, type AiProvider, type BookmarkType } from "@/db/schema";
import { PROVIDERS } from "./ai-providers";
import { AI_UNAVAILABLE } from "./errors";

/** Which provider, key and models to call for one user. */
export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  /** Null when the provider can't embed (Anthropic, Groq): search then uses keywords only. */
  embeddingModel: string | null;
  /** "user" for the user's own key; "server" for the optional shared key in the environment. */
  source: "user" | "server";
};

export function configFor(provider: AiProvider, apiKey: string, model?: string | null): AiConfig {
  const info = PROVIDERS[provider];
  return {
    provider,
    apiKey,
    model: model?.trim() || info.defaultModel,
    embeddingModel: info.embeddingModel,
    source: "user",
  };
}

const SERVER_KEYS: Partial<Record<AiProvider, string>> = {
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
};

/**
 * The server's own key, for users who haven't added theirs. Off unless AI_USE_SERVER_KEY=true, so
 * a public deployment never spends the operator's credits on other people's bookmarks.
 */
export function serverConfig(): AiConfig | null {
  if (process.env.AI_USE_SERVER_KEY !== "true") return null;
  const chosen = process.env.AI_PROVIDER as AiProvider | undefined;
  const provider: AiProvider = chosen && chosen in PROVIDERS ? chosen : "openrouter";
  const apiKey = process.env[SERVER_KEYS[provider]!];
  if (!apiKey) return null;
  const info = PROVIDERS[provider];
  return {
    provider,
    apiKey,
    model: process.env.AI_MODEL || info.defaultModel,
    embeddingModel: info.embeddingModel ? process.env.AI_EMBEDDING_MODEL || info.embeddingModel : null,
    source: "server",
  };
}

/**
 * A stable name for the embedding model, stored next to each vector. OpenAI's model reached
 * directly or through OpenRouter is the same model, so both give "openai/text-embedding-3-small".
 */
export function embeddingSpace(ai: AiConfig): string | null {
  if (!ai.embeddingModel) return null;
  if (ai.provider === "openrouter") return ai.embeddingModel;
  return `${ai.provider}/${ai.embeddingModel}`;
}

function languageModel(ai: AiConfig): LanguageModel {
  const { apiKey } = ai;
  switch (ai.provider) {
    case "openrouter":
      return createOpenRouter({ apiKey, appName: "Auto Bookmark" })(ai.model);
    case "anthropic":
      return createAnthropic({ apiKey })(ai.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(ai.model);
    case "groq": {
      const model = createGroq({ apiKey })(ai.model);
      // GPT-OSS reasons before answering, and that counts toward each call's output cap. Other Groq
      // models reject the setting.
      if (!ai.model.includes("gpt-oss")) return model;
      return wrapLanguageModel({
        model,
        middleware: defaultSettingsMiddleware({ settings: { providerOptions: { groq: { reasoningEffort: "low" } } } }),
      });
    }
    case "openai":
      return createOpenAI({ apiKey })(ai.model);
  }
}

function embeddingModel(ai: AiConfig): EmbeddingModel | null {
  const { apiKey, embeddingModel: id } = ai;
  if (!id) return null;
  switch (ai.provider) {
    case "openrouter":
      return createOpenRouter({ apiKey, appName: "Auto Bookmark" }).textEmbeddingModel(id);
    case "google":
      return createGoogleGenerativeAI({ apiKey }).embeddingModel(id);
    case "openai":
      return createOpenAI({ apiKey }).embeddingModel(id);
    case "anthropic":
    case "groq":
      return null;
  }
}

/**
 * A message for the user about a failed AI call. With their own key, the user can act on the
 * provider's answer (bad key, no credits), so it's named. Raw provider text is never shown.
 */
export function aiFailureMessage(err: unknown, ai: AiConfig | null, { inSettings = false } = {}) {
  if (!ai || ai.source !== "user") return AI_UNAVAILABLE;
  const cause = RetryError.isInstance(err) ? err.lastError : err;
  const call = APICallError.isInstance(cause) ? cause : null;
  // Google answers a bad key with 400 rather than 401, and Anthropic an empty balance with 400.
  const body = call?.responseBody ?? "";
  const status =
    call?.statusCode === 400 && /API_KEY_INVALID|api key not valid/i.test(body)
      ? 401
      : call?.statusCode === 400 && /credit balance/i.test(body)
        ? 402
        : call?.statusCode;
  const { name } = PROVIDERS[ai.provider];
  const check = (what: string) => (inSettings ? "" : ` Check ${what} in Settings.`);
  switch (status) {
    case 401:
    case 403:
      return `${name} rejected your API key.${check("it")}`;
    case 402:
      return `Your ${name} account is out of credits. Add credits with ${name}, then try again.`;
    case 429:
      return `${name} is rate-limiting your key or its quota is used up. Try again in a while.`;
    case 400:
    case 404:
      return `${name} couldn't run the model “${ai.model}”.${check("the model")}`;
    default:
      return AI_UNAVAILABLE;
  }
}

/** One tiny request per model, to check a key before it's saved. Throws what the provider answered. */
export async function testConfig(ai: AiConfig) {
  await generateText({ model: languageModel(ai), prompt: "Reply with the word OK.", maxOutputTokens: 64 });
  if (ai.embeddingModel) await embedText(ai, "test", "query");
}

/** Null when the provider has no embedding model. */
export async function embedText(ai: AiConfig, value: string, purpose: "document" | "query") {
  const model = embeddingModel(ai);
  if (!model) return null;
  const { embedding } = await embed({
    model,
    value: value.slice(0, 8000),
    providerOptions: {
      openai: { dimensions: EMBEDDING_DIMENSIONS },
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: purpose === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
      },
    },
  });
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `The embedding model returned ${embedding.length} dimensions; pick one that returns ${EMBEDDING_DIMENSIONS}.`,
    );
  }
  return embedding;
}

export type CategoryHint = { name: string; description: string | null };

function describeCategories(categories: CategoryHint[]) {
  if (!categories.length) return "(none yet — create the first one)";
  return categories
    .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
    .join("\n");
}

const CATEGORY_RULES = `Category rules:
- File by subject matter: what the item is about, not where it was posted or what format it is.
- First decide the item's topic, then find the closest existing category and judge honestly whether
  the item belongs there. Reuse it only if someone browsing that category would clearly expect to
  find this item there. A loose or technical link (the page is a web app, the post mentions a
  computer) is not enough. A category with no description means exactly what its name says.
- If no existing category is a clear fit, create a new one. Many focused categories are better
  than a few catch-alls, so never force an item into a poor fit.
- New categories are mid-level topics of 1–3 words in Title Case, specific enough to group related
  items yet reusable for future ones, e.g. "Web Development", "AI Tools", "Football", "Cars",
  "Personal Finance", "Cooking", "Deals & Giveaways", "Productivity". Prefer the plain, everyday name
  for the subject area ("Football" rather than "Sports Personal Brands", "Cars" rather than
  "Automotive Marketing"). Never one-off labels tied to a single item, and never umbrella buckets
  like "Technology", "General", "Entertainment", "Miscellaneous", "Other" or "Interesting".
- Do not use format words such as "Video", "Tweet", "Post" or "Article" as a new category.
- The description is one sentence naming the specific kinds of things that belong in the category,
  narrow enough that unrelated items would clearly not fit.`;

const categoryDecision = {
  topic: z
    .string()
    .describe(
      "In a few words, the specific subject of the item, e.g. 'React image cropping library' or 'Cristiano Ronaldo's career'.",
    ),
  closestExisting: z
    .string()
    .nullable()
    .describe("The existing category closest to the topic, or null if there are no categories yet."),
  closestFits: z
    .boolean()
    .describe(
      "True only if the topic squarely belongs in closestExisting as its name and description define it. False if it is merely adjacent (e.g. both involve software or the internet).",
    ),
  category: z
    .object({ name: z.string(), description: z.string() })
    .describe("closestExisting (exact name) when closestFits is true, otherwise a new category."),
};

const analysisSchema = z.object({
  title: z.string().describe("A clear, human readable title for the item (max ~90 chars)."),
  summary: z
    .string()
    .describe("A 2–4 sentence summary of what the content says, written so it can be found later."),
  keyPoints: z.array(z.string()).describe("3–5 short key takeaways."),
  tags: z
    .array(z.string())
    .describe("3–8 lowercase topical tags: specific names, technologies, people, concepts."),
  ...categoryDecision,
});

export type Analysis = z.infer<typeof analysisSchema>;

export async function analyzeContent(
  ai: AiConfig,
  item: {
    url: string;
    type: BookmarkType;
    title?: string | null;
    author?: string | null;
    siteName?: string | null;
    description?: string | null;
    content?: string | null;
    note?: string | null;
  },
  categories: CategoryHint[],
): Promise<Analysis> {
  const kind = { web: "web page", tweet: "post on X (Twitter)", youtube: "YouTube video" }[item.type];
  const body = [
    `Kind: ${kind}`,
    `URL: ${item.url}`,
    item.title && `Title: ${item.title}`,
    item.author && `Author: ${item.author}`,
    item.siteName && `Site: ${item.siteName}`,
    item.description && `Description: ${item.description}`,
    item.note && `Text the user highlighted: ${item.note}`,
    `Content:\n${(item.content ?? "").slice(0, 14_000) || "(no content could be extracted — infer from the metadata above)"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { output } = await generateText({
    model: languageModel(ai),
    output: Output.object({ schema: analysisSchema }),
    maxOutputTokens: 2000,
    instructions: `You organize a person's personal bookmark library. For each saved item you write a
faithful summary, pull out key points and tags, and file it under one category.
Write in the same language as the content when it is not English, but category names stay in English.

${CATEGORY_RULES}

Existing categories:
${describeCategories(categories)}`,
    prompt: body,
  });
  return output;
}

const classificationSchema = z.object(categoryDecision);

export async function classifyItem(
  ai: AiConfig,
  item: { title: string | null; summary: string | null; tags: string[]; url: string },
  categories: CategoryHint[],
) {
  const { output } = await generateText({
    model: languageModel(ai),
    output: Output.object({ schema: classificationSchema }),
    maxOutputTokens: 500,
    instructions: `You file items in a personal bookmark library under exactly one category.

${CATEGORY_RULES}

Existing categories:
${describeCategories(categories)}`,
    prompt: `Title: ${item.title ?? ""}\nURL: ${item.url}\nTags: ${item.tags.join(", ")}\nSummary: ${item.summary ?? ""}`,
  });
  return output.category;
}

const queryPlanSchema = z.object({
  searchText: z
    .string()
    .describe("The topical part of the request, rewritten as a descriptive search phrase."),
  type: z.enum(["any", "web", "tweet", "youtube"]),
  category: z.string().nullable().describe("An existing category name if the user named one, else null."),
  savedAfter: z.string().nullable().describe("ISO date (YYYY-MM-DD) or null."),
  savedBefore: z.string().nullable().describe("ISO date (YYYY-MM-DD) or null."),
});

export type QueryPlan = z.infer<typeof queryPlanSchema>;

/** Turns "that youtube video about rust I saved last month" into filters + a search phrase. */
export async function planSearch(ai: AiConfig, query: string, categories: string[]): Promise<QueryPlan> {
  const { output } = await generateText({
    model: languageModel(ai),
    output: Output.object({ schema: queryPlanSchema }),
    maxOutputTokens: 500,
    instructions: `You turn a natural-language request for something in a personal bookmark library into search filters.
Today is ${new Date().toISOString().slice(0, 10)}.
- type: "youtube" for videos, "tweet" for posts/tweets/threads on X or Twitter, "web" for articles/pages/blogs, otherwise "any".
- Only set dates when the user refers to when they saved it ("last week", "in March").
- Only set category when the user clearly names one of: ${categories.join(", ") || "(none)"}.
- searchText keeps every topical detail the user remembers but drops filler like "that thing I saved".`,
    prompt: query,
  });
  return output;
}

export type AnswerSource = {
  title: string;
  kind: string;
  savedOn: string;
  summary: string | null;
  keyPoints: string[];
  highlight: string | null;
  tags: string[];
};

/**
 * Writes a short answer to a question using only the user's saved bookmarks, citing them as [n].
 * Sources are numbered in the order given, starting at 1.
 */
export function streamAnswer(ai: AiConfig, question: string, sources: AnswerSource[], abortSignal?: AbortSignal) {
  const context = sources
    .map((s, i) =>
      [
        `[${i + 1}] ${s.title} (${s.kind}, saved ${s.savedOn})`,
        s.summary && `Summary: ${s.summary}`,
        s.keyPoints.length ? `Key points:\n${s.keyPoints.map((p) => `- ${p}`).join("\n")}` : null,
        s.highlight && `The user highlighted: ${s.highlight}`,
        s.tags.length ? `Tags: ${s.tags.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  return streamText({
    model: languageModel(ai),
    maxOutputTokens: 900,
    abortSignal,
    instructions: `You answer questions about a person's own bookmark library, using only the saved items below.
Today is ${new Date().toISOString().slice(0, 10)}.
- Answer directly in plain sentences, at most about 180 words. Short paragraphs; use "- " bullets only for lists.
- No headings, no bold, no tables, no preamble like "Based on your bookmarks".
- After each claim, cite the items it comes from as [1] or [1][3]. Only cite numbers that exist.
- Use only what the items say. If they don't cover the question, say so in one sentence and mention
  the closest thing that was saved, if any. Never fill gaps from general knowledge.
- Speak to the user as "you" ("You saved a guide that...").

Saved items:
${context}`,
    prompt: question,
  });
}
