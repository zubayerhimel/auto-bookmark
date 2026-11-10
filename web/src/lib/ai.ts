import "server-only";
import { embed, generateText, Output, streamText, type EmbeddingModel, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, type BookmarkType } from "@/db/schema";

type Provider = "openrouter" | "openai" | "google";

const API_KEYS: Record<Provider, string> = {
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

const DEFAULT_MODELS: Record<Provider, { chat: string; embedding: string }> = {
  openrouter: { chat: "openai/gpt-5.4-mini", embedding: "openai/text-embedding-3-small" },
  openai: { chat: "gpt-5.4-mini", embedding: "text-embedding-3-small" },
  google: { chat: "gemini-3.5-flash", embedding: "gemini-embedding-001" },
};

function provider(): Provider {
  const chosen = process.env.AI_PROVIDER;
  if (chosen === "openrouter" || chosen === "openai" || chosen === "google") return chosen;
  return "openrouter";
}

function assertConfigured() {
  const key = API_KEYS[provider()];
  if (!process.env[key]) throw new Error(`AI is not set up: add ${key} to web/.env.local and restart the app.`);
}

function openrouter() {
  return createOpenRouter({ appName: "Auto Bookmark" });
}

function languageModel(): LanguageModel {
  assertConfigured();
  const p = provider();
  const id = process.env.AI_MODEL || DEFAULT_MODELS[p].chat;
  if (p === "openrouter") return openrouter()(id);
  if (p === "google") return createGoogleGenerativeAI()(id);
  return createOpenAI()(id);
}

function embeddingModel(): EmbeddingModel {
  assertConfigured();
  const p = provider();
  const id = process.env.AI_EMBEDDING_MODEL || DEFAULT_MODELS[p].embedding;
  if (p === "openrouter") return openrouter().textEmbeddingModel(id);
  if (p === "google") return createGoogleGenerativeAI().embeddingModel(id);
  return createOpenAI().embeddingModel(id);
}

export async function embedText(value: string, purpose: "document" | "query") {
  const { embedding } = await embed({
    model: embeddingModel(),
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
      `The embedding model returned ${embedding.length} dimensions; pick one that returns ${EMBEDDING_DIMENSIONS} (AI_EMBEDDING_MODEL).`,
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
- Reuse an existing category whenever the item reasonably fits it. Use its exact name.
- Only invent a new category when none of the existing ones fit. New categories should be broad,
  reusable topics of 1–3 words in Title Case (e.g. "Technology", "Personal Finance", "Cooking",
  "Machine Learning", "Design"), never one-off labels tied to a single item.
- Do not use format words such as "Video", "Tweet" or "Article" as a category.
- Give a one-sentence description of what belongs in the category.`;

const analysisSchema = z.object({
  title: z.string().describe("A clear, human readable title for the item (max ~90 chars)."),
  summary: z
    .string()
    .describe("A 2–4 sentence summary of what the content says, written so it can be found later."),
  keyPoints: z.array(z.string()).describe("3–5 short key takeaways."),
  tags: z
    .array(z.string())
    .describe("3–8 lowercase topical tags: specific names, technologies, people, concepts."),
  category: z.object({
    name: z.string(),
    description: z.string(),
  }),
});

export type Analysis = z.infer<typeof analysisSchema>;

export async function analyzeContent(
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
    model: languageModel(),
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

const classificationSchema = z.object({
  category: z.object({ name: z.string(), description: z.string() }),
});

export async function classifyItem(
  item: { title: string | null; summary: string | null; tags: string[]; url: string },
  categories: CategoryHint[],
) {
  const { output } = await generateText({
    model: languageModel(),
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
export async function planSearch(query: string, categories: string[]): Promise<QueryPlan> {
  const { output } = await generateText({
    model: languageModel(),
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
export function streamAnswer(question: string, sources: AnswerSource[], abortSignal?: AbortSignal) {
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
    model: languageModel(),
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
