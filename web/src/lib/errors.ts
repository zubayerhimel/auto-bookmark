/**
 * An error whose message was written for the user. Only these reach the screen; anything else
 * (AI provider, database, network library) can carry account ids, keys or internals, so it's
 * logged on the server and replaced with a general message.
 */
export class UserError extends Error {
  override name = "UserError";
}

export function userMessage(err: unknown, fallback: string) {
  return err instanceof UserError ? err.message : fallback;
}

export const AI_UNAVAILABLE = "The AI service couldn't summarize this right now. Try again in a while.";
export const PROCESSING_FAILED = "Something went wrong while processing this. Try again.";
