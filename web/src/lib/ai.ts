import "server-only";
import { embed, generateText, Output, type EmbeddingModel, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, type BookmarkType } from "@/db/schema";

type Provider = "openai" | "google";

function provider(): Provider {
  return process.env.AI_PROVIDER === "google" ? "google" : "openai";
}

function assertConfigured() {
  const key = provider() === "google" ? "GOOGLE_GENERATIVE_AI_API_KEY" : "OPENAI_API_KEY";
  if (!process.env[key]) throw new Error(`AI is not set up: add ${key} to web/.env.local and restart the app.`);
}

function languageModel(): LanguageModel {
  assertConfigured();
  if (provider() === "google") {
    const google = createGoogleGenerativeAI();
    return google(process.env.AI_MODEL || "gemini-3.5-flash");
  }
  const openai = createOpenAI();
  return openai(process.env.AI_MODEL || "gpt-5.4-mini");
}

function embeddingModel(): EmbeddingModel {
  assertConfigured();
  if (provider() === "google") {
    return createGoogleGenerativeAI().embeddingModel(
      process.env.AI_EMBEDDING_MODEL || "gemini-embedding-001",
    );
  }
  return createOpenAI().embeddingModel(process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small");
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
