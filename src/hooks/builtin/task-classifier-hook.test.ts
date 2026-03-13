import { describe, expect, it } from "vitest";
import { createHookRunner } from "../../plugins/hooks.js";
import { createEmptyPluginRegistry } from "../../plugins/registry.js";
import type { PluginHookAgentContext } from "../../plugins/types.js";
import {
  createTaskClassifierHandler,
  DEFAULT_MODEL_ROUTING,
  parseModelSpec,
  registerTaskClassifierHook,
  resolveModelRoutingConfig,
  type ModelRoutingConfig,
} from "./task-classifier-hook.js";

const stubCtx: PluginHookAgentContext = {
  agentId: "test-agent",
  sessionKey: "test-session",
  sessionId: "test-session-id",
  workspaceDir: "/tmp/test",
  messageProvider: "test",
};

// The classifier treats prompts under 200 tokens as "cheap" (triage).
// With the ~4 chars/token heuristic, prompts need ≥800 chars to exceed
// that threshold and reach the mid/expensive classification paths.
const LONG_PADDING = " ".repeat(900);

describe("parseModelSpec", () => {
  it("splits provider/model on slash", () => {
    expect(parseModelSpec("anthropic/claude-haiku-4-5")).toEqual({
      providerOverride: "anthropic",
      modelOverride: "claude-haiku-4-5",
    });
  });

  it("returns modelOverride only when no slash", () => {
    expect(parseModelSpec("gpt-4o")).toEqual({ modelOverride: "gpt-4o" });
  });

  it("returns empty object for empty string", () => {
    expect(parseModelSpec("")).toEqual({});
  });
});

describe("createTaskClassifierHandler", () => {
  const routing: ModelRoutingConfig = {
    cheap: "anthropic/claude-haiku-4-5",
    mid: "",
    expensive: "anthropic/claude-opus-4-6",
  };

  it("heartbeat trigger → cheap model", () => {
    const handler = createTaskClassifierHandler(routing);
    const result = handler({ prompt: "heartbeat check" }, { ...stubCtx, trigger: "heartbeat" });
    expect(result).toEqual({
      providerOverride: "anthropic",
      modelOverride: "claude-haiku-4-5",
    });
  });

  it("cron trigger → cheap model for routine crons", () => {
    const handler = createTaskClassifierHandler(routing);
    const result = handler(
      { prompt: "run evening check" },
      { ...stubCtx, trigger: "cron", channelId: "evening-digest" },
    );
    expect(result).toEqual({
      providerOverride: "anthropic",
      modelOverride: "claude-haiku-4-5",
    });
  });

  it("short user message → cheap model (triage)", () => {
    const handler = createTaskClassifierHandler(routing);
    const result = handler({ prompt: "hello" }, { ...stubCtx, trigger: "user" });
    // Short prompts (<200 tokens) are classified as cheap/triage
    expect(result).toEqual({
      providerOverride: "anthropic",
      modelOverride: "claude-haiku-4-5",
    });
  });

  it("longer user message without keywords → mid (no override)", () => {
    const handler = createTaskClassifierHandler(routing);
    const result = handler(
      { prompt: `please help me with this task${LONG_PADDING}` },
      { ...stubCtx, trigger: "user" },
    );
    // mid is empty string → no override
    expect(result).toBeUndefined();
  });

  it("strategic keyword in long prompt → expensive model", () => {
    const handler = createTaskClassifierHandler(routing);
    const result = handler(
      { prompt: `architect a new microservice architecture for the payment system${LONG_PADDING}` },
      { ...stubCtx, trigger: "user" },
    );
    expect(result).toEqual({
      providerOverride: "anthropic",
      modelOverride: "claude-opus-4-6",
    });
  });

  it("debug keyword in long prompt → expensive model", () => {
    const handler = createTaskClassifierHandler(routing);
    const result = handler(
      { prompt: `debug the authentication failure in production${LONG_PADDING}` },
      { ...stubCtx, trigger: "user" },
    );
    expect(result).toEqual({
      providerOverride: "anthropic",
      modelOverride: "claude-opus-4-6",
    });
  });

  it("config values override defaults", () => {
    const custom: ModelRoutingConfig = {
      cheap: "openai/gpt-4o-mini",
      mid: "openai/gpt-4o",
      expensive: "openai/o1",
    };
    const handler = createTaskClassifierHandler(custom);

    // Heartbeat → cheap
    const cheapResult = handler({ prompt: "heartbeat" }, { ...stubCtx, trigger: "heartbeat" });
    expect(cheapResult).toEqual({
      providerOverride: "openai",
      modelOverride: "gpt-4o-mini",
    });

    // Strategic → expensive (long prompt to exceed token threshold)
    const expensiveResult = handler(
      { prompt: `architect a distributed system${LONG_PADDING}` },
      { ...stubCtx, trigger: "user" },
    );
    expect(expensiveResult).toEqual({
      providerOverride: "openai",
      modelOverride: "o1",
    });

    // Mid-range → mid
    const midResult = handler(
      { prompt: `please help me with this task${LONG_PADDING}` },
      { ...stubCtx, trigger: "user" },
    );
    expect(midResult).toEqual({
      providerOverride: "openai",
      modelOverride: "gpt-4o",
    });
  });

  it("model spec without provider returns modelOverride only", () => {
    const custom: ModelRoutingConfig = {
      cheap: "haiku",
      mid: "",
      expensive: "opus",
    };
    const handler = createTaskClassifierHandler(custom);
    const result = handler({ prompt: "heartbeat" }, { ...stubCtx, trigger: "heartbeat" });
    expect(result).toEqual({ modelOverride: "haiku" });
  });
});

describe("resolveModelRoutingConfig", () => {
  it("uses defaults when no env vars", () => {
    const config = resolveModelRoutingConfig({});
    expect(config).toEqual(DEFAULT_MODEL_ROUTING);
  });

  it("reads from env vars", () => {
    const config = resolveModelRoutingConfig({
      OPENCLAW_MODEL_ROUTING_CHEAP: "openai/gpt-4o-mini",
      OPENCLAW_MODEL_ROUTING_MID: "openai/gpt-4o",
      OPENCLAW_MODEL_ROUTING_EXPENSIVE: "openai/o1",
    });
    expect(config).toEqual({
      cheap: "openai/gpt-4o-mini",
      mid: "openai/gpt-4o",
      expensive: "openai/o1",
    });
  });
});

describe("registerTaskClassifierHook (integration)", () => {
  it("registers on registry and routes heartbeat to cheap model via hook runner", async () => {
    const registry = createEmptyPluginRegistry();
    registerTaskClassifierHook(registry);

    const runner = createHookRunner(registry);
    expect(runner.hasHooks("before_model_resolve")).toBe(true);

    const result = await runner.runBeforeModelResolve(
      { prompt: "heartbeat check" },
      { ...stubCtx, trigger: "heartbeat" },
    );
    expect(result?.providerOverride).toBe("anthropic");
    expect(result?.modelOverride).toBe("claude-haiku-4-5");
  });

  it("registers with custom config override", async () => {
    const registry = createEmptyPluginRegistry();
    registerTaskClassifierHook(registry, { cheap: "ollama/llama3" });

    const runner = createHookRunner(registry);
    const result = await runner.runBeforeModelResolve(
      { prompt: "heartbeat" },
      { ...stubCtx, trigger: "heartbeat" },
    );
    expect(result?.providerOverride).toBe("ollama");
    expect(result?.modelOverride).toBe("llama3");
  });

  it("returns no override for mid-tier when mid is empty", async () => {
    const registry = createEmptyPluginRegistry();
    registerTaskClassifierHook(registry);

    const runner = createHookRunner(registry);
    // Long prompt without strategic keywords → mid → empty → no override
    const result = await runner.runBeforeModelResolve(
      { prompt: `please help me organize my files${LONG_PADDING}` },
      { ...stubCtx, trigger: "user" },
    );
    expect(result).toBeUndefined();
  });

  it("routes strategic prompt to expensive model via hook runner", async () => {
    const registry = createEmptyPluginRegistry();
    registerTaskClassifierHook(registry);

    const runner = createHookRunner(registry);
    const result = await runner.runBeforeModelResolve(
      { prompt: `architect a new system for handling payments${LONG_PADDING}` },
      { ...stubCtx, trigger: "user" },
    );
    expect(result?.providerOverride).toBe("anthropic");
    expect(result?.modelOverride).toBe("claude-opus-4-6");
  });
});
