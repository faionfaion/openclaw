// Builtin before_model_resolve hook: routes to cheap/mid/expensive models
// based on task classification from src/agents/task-classifier.ts

import { classify } from "../../agents/task-classifier.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import type { PluginRegistry } from "../../plugins/registry.js";
import type {
  PluginHookAgentContext,
  PluginHookBeforeModelResolveEvent,
  PluginHookBeforeModelResolveResult,
  PluginHookRegistration,
} from "../../plugins/types.js";

const log = createSubsystemLogger("hooks/task-classifier");

const BUILTIN_PLUGIN_ID = "builtin:task-classifier";

export type ModelRoutingConfig = {
  /** Model for cheap/routine tasks (heartbeats, crons). Empty = no override. */
  cheap: string;
  /** Model for mid-tier tasks (standard user messages). Empty = no override. */
  mid: string;
  /** Model for expensive/strategic tasks. Empty = no override. */
  expensive: string;
};

export const DEFAULT_MODEL_ROUTING: Readonly<ModelRoutingConfig> = {
  cheap: "anthropic/claude-haiku-4-5",
  mid: "", // empty = do not override, use default
  expensive: "anthropic/claude-opus-4-6",
};

/**
 * Parse a "provider/model" string into provider and model parts.
 * Returns undefined parts when the string is empty or has no slash.
 */
export function parseModelSpec(spec: string): {
  providerOverride?: string;
  modelOverride?: string;
} {
  if (!spec) {
    return {};
  }
  const slashIdx = spec.indexOf("/");
  if (slashIdx > 0) {
    return {
      providerOverride: spec.slice(0, slashIdx),
      modelOverride: spec.slice(slashIdx + 1),
    };
  }
  // No slash — treat entire string as model ID
  return { modelOverride: spec };
}

/**
 * Build the before_model_resolve handler with a given routing config.
 */
export function createTaskClassifierHandler(
  routing: ModelRoutingConfig,
): (
  event: PluginHookBeforeModelResolveEvent,
  ctx: PluginHookAgentContext,
) => PluginHookBeforeModelResolveResult | undefined {
  return (event, ctx) => {
    const isHeartbeat = ctx.trigger === "heartbeat";
    const cronName = ctx.trigger === "cron" ? (ctx.channelId ?? "cron") : undefined;

    // Rough token estimate (~4 chars per token) so the classifier can
    // distinguish short triage prompts from longer strategic ones.
    const promptTokens = Math.ceil(event.prompt.length / 4);

    const classification = classify({
      promptText: event.prompt,
      isHeartbeat,
      cronName,
      promptTokens,
    });

    const modelSpec = routing[classification.load];
    if (!modelSpec) {
      log.debug("task-classifier: no override", { load: classification.load });
      return undefined;
    }

    const result = parseModelSpec(modelSpec);
    log.info("task-classifier: routed", {
      load: classification.load,
      pattern: classification.pattern,
      model: modelSpec,
    });
    return result;
  };
}

/**
 * Read model routing config from environment variables, falling back to defaults.
 */
export function resolveModelRoutingConfig(
  env: NodeJS.ProcessEnv = process.env,
): ModelRoutingConfig {
  return {
    cheap: env.OPENCLAW_MODEL_ROUTING_CHEAP?.trim() ?? DEFAULT_MODEL_ROUTING.cheap,
    mid: env.OPENCLAW_MODEL_ROUTING_MID?.trim() ?? DEFAULT_MODEL_ROUTING.mid,
    expensive: env.OPENCLAW_MODEL_ROUTING_EXPENSIVE?.trim() ?? DEFAULT_MODEL_ROUTING.expensive,
  };
}

/**
 * Register the task-classifier before_model_resolve hook on a plugin registry.
 */
export function registerTaskClassifierHook(
  registry: PluginRegistry,
  config?: Partial<ModelRoutingConfig>,
): void {
  const routing: ModelRoutingConfig = {
    ...resolveModelRoutingConfig(),
    ...config,
  };
  const handler = createTaskClassifierHandler(routing);
  registry.typedHooks.push({
    pluginId: BUILTIN_PLUGIN_ID,
    hookName: "before_model_resolve",
    handler,
    priority: -10, // low priority so user plugins can override
    source: "builtin",
  } as PluginHookRegistration);
}
