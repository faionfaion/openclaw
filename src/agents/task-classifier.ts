/**
 * Task classifier for dynamic model routing.
 *
 * Maps incoming work to a cognitive-load tier so callers can pick
 * the cheapest model that is still adequate for the job.
 */

export type CognitiveLoad = "cheap" | "mid" | "expensive";

export function classifyTask(context: {
  isHeartbeat?: boolean;
  cronName?: string;
  promptText?: string;
  promptTokens?: number;
  hasCodeBlocks?: boolean;
  failedAttempts?: number;
}): CognitiveLoad {
  // Cheap signals → Haiku
  if (context.isHeartbeat) {
    return "cheap";
  }
  if (context.cronName?.match(/evening|upstream|memory|stale/i)) {
    return "cheap";
  }
  if (context.promptTokens && context.promptTokens < 200 && !context.hasCodeBlocks) {
    return "cheap";
  }

  // Expensive signals → Opus
  if (
    context.promptText?.match(
      /architect|refactor|design|strategy|spec|security|think hard|weekly.review|deep.sleep/i,
    )
  ) {
    return "expensive";
  }
  if (context.failedAttempts && context.failedAttempts >= 2) {
    return "expensive";
  }

  // Default → Sonnet
  return "mid";
}

export function getModelForLoad(
  load: CognitiveLoad,
  config?: {
    cheap?: string;
    mid?: string;
    expensive?: string;
  },
): string {
  const defaults = {
    cheap: "anthropic/claude-haiku-4-5",
    mid: "anthropic/claude-sonnet-4-6",
    expensive: "anthropic/claude-opus-4-6",
  };
  const models = { ...defaults, ...config };
  return models[load];
}
