/**
 * ChannelPlugin definition for the telegram-userbot channel.
 *
 * Wires together all adapters (config, setup, auth, status, security,
 * gateway) into a single ChannelPlugin object that OpenClaw's channel
 * registry consumes.
 */

import type { ChannelGatewayContext, ChannelPlugin } from "openclaw/plugin-sdk";
import {
  createReplyPrefixOptions,
  resolveInboundRouteEnvelopeBuilderWithRuntime,
} from "openclaw/plugin-sdk";
import { telegramUserbotAgentPromptAdapter } from "./adapters/agent-prompt.js";
import { telegramUserbotAuthAdapter } from "./adapters/auth.js";
import {
  telegramUserbotConfigAdapter,
  resolveTelegramUserbotAccount,
  type ResolvedTelegramUserbotAccount,
} from "./adapters/config.js";
import { telegramUserbotDirectoryAdapter } from "./adapters/directory.js";
import { telegramUserbotMessageActions } from "./adapters/message-actions.js";
import { telegramUserbotOutboundAdapter } from "./adapters/outbound.js";
import { telegramUserbotSecurityAdapter } from "./adapters/security.js";
import { telegramUserbotSetupAdapter } from "./adapters/setup.js";
import { telegramUserbotStatusAdapter, type TelegramUserbotProbe } from "./adapters/status.js";
import { telegramUserbotStreamingAdapter } from "./adapters/streaming.js";
import { telegramUserbotThreadingAdapter } from "./adapters/threading.js";
import { telegramUserbotMeta, TELEGRAM_USERBOT_CHANNEL_ID } from "./config-schema.js";
import { ConnectionManager } from "./connection.js";
import { FloodController } from "./flood-control.js";
import type { InboundTelegramMessage } from "./inbound.js";
import { registerInboundHandlers } from "./inbound.js";
import { incrementMetric } from "./monitor.js";
import { telegramUserbotOnboardingAdapter } from "./onboarding.js";
import { sendMedia, sendText } from "./outbound.js";

// ---------------------------------------------------------------------------
// Per-account ConnectionManager instances
// ---------------------------------------------------------------------------

const connectionManagers = new Map<string, ConnectionManager>();

// ---------------------------------------------------------------------------
// Per-account FloodController cache (shared with inbound reply delivery)
// ---------------------------------------------------------------------------

const inboundFloodControllers = new Map<string, FloodController>();

function getOrCreateInboundFloodController(
  accountId: string,
  rateLimit?: {
    messagesPerSecond?: number;
    perChatPerSecond?: number;
    jitterMs?: [number, number];
  },
): FloodController {
  let fc = inboundFloodControllers.get(accountId);
  if (!fc) {
    fc = new FloodController({
      globalRate: rateLimit?.messagesPerSecond,
      perChatRate: rateLimit?.perChatPerSecond,
      jitterMs: rateLimit?.jitterMs,
    });
    inboundFloodControllers.set(accountId, fc);
  }
  return fc;
}

// ---------------------------------------------------------------------------
// Inbound message dispatch
// ---------------------------------------------------------------------------

async function dispatchInboundMessage(
  msg: InboundTelegramMessage,
  ctx: ChannelGatewayContext<ResolvedTelegramUserbotAccount>,
): Promise<void> {
  const core = ctx.channelRuntime;
  if (!core) {
    ctx.log?.warn?.(`[${ctx.accountId}] channelRuntime not available, skipping inbound dispatch`);
    return;
  }

  incrementMetric(ctx.accountId, "messagesReceived");

  const isGroup = msg.chatType === "group" || msg.chatType === "supergroup";

  const { route, buildEnvelope } = resolveInboundRouteEnvelopeBuilderWithRuntime({
    cfg: ctx.cfg,
    channel: TELEGRAM_USERBOT_CHANNEL_ID,
    accountId: ctx.accountId,
    peer: {
      kind: isGroup ? "group" : "direct",
      id: msg.chatId,
    },
    runtime: core,
    sessionStore: ctx.cfg.session?.store,
  });

  const fromLabel = msg.senderName || `user:${msg.senderId}`;
  const { storePath, body } = buildEnvelope({
    channel: "Telegram (User)",
    from: fromLabel,
    body: msg.text,
  });

  const ctxPayload = core.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: msg.text,
    RawBody: msg.text,
    CommandBody: msg.text,
    From: `telegram-userbot:${msg.senderId}`,
    To: msg.channelChatId,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    ConversationLabel: msg.chatTitle || fromLabel,
    SenderName: msg.senderName,
    SenderId: String(msg.senderId),
    Provider: TELEGRAM_USERBOT_CHANNEL_ID,
    Surface: TELEGRAM_USERBOT_CHANNEL_ID,
    MessageSid: String(msg.messageId),
    ReplyToId: msg.replyToMessageId ? String(msg.replyToMessageId) : undefined,
    MediaType: msg.mediaType,
    OriginatingChannel: TELEGRAM_USERBOT_CHANNEL_ID,
    OriginatingTo: msg.channelChatId,
  });

  void core.session
    .recordSessionMetaFromInbound({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
    })
    .catch((err: unknown) => {
      ctx.log?.error?.(`[${ctx.accountId}] failed updating session meta: ${String(err)}`);
    });

  const account = ctx.account;
  const floodController = getOrCreateInboundFloodController(
    account.accountId,
    account.config.rateLimit,
  );
  const client = connectionManagers.get(account.accountId)?.getClient();
  if (!client) {
    ctx.log?.error?.(`[${ctx.accountId}] client unavailable for reply delivery`);
    return;
  }

  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: ctx.cfg,
    agentId: route.agentId,
    channel: TELEGRAM_USERBOT_CHANNEL_ID,
    accountId: route.accountId,
  });

  await core.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: ctx.cfg,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (payload) => {
        ctx.log?.info?.(
          `[${ctx.accountId}] deliver callback called, chatId=${msg.chatId}, hasText=${!!payload.text}, hasMedia=${!!payload.mediaUrl}`,
        );
        if (payload.mediaUrl) {
          const mediaResult = await sendMedia({
            client,
            floodController,
            chatId: msg.chatId,
            file: payload.mediaUrl,
            caption: payload.text || undefined,
          });
          if (mediaResult.error) {
            ctx.log?.error?.(`[${ctx.accountId}] sendMedia error: ${mediaResult.error}`);
            throw new Error(mediaResult.error);
          }
        } else if (payload.text) {
          const textResult = await sendText({
            client,
            floodController,
            chatId: msg.chatId,
            text: payload.text,
          });
          if (textResult.error) {
            ctx.log?.error?.(`[${ctx.accountId}] sendText error: ${textResult.error}`);
            throw new Error(textResult.error);
          }
        }
      },
      onError: (err, info) => {
        ctx.log?.error?.(
          `[${ctx.accountId}] telegram-userbot ${info.kind} reply failed: ${String(err)}`,
        );
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const telegramUserbotPlugin: ChannelPlugin<
  ResolvedTelegramUserbotAccount,
  TelegramUserbotProbe
> = {
  id: TELEGRAM_USERBOT_CHANNEL_ID,
  meta: {
    ...telegramUserbotMeta,
  },

  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: true,
    edit: true,
    unsend: true,
    reply: true,
    blockStreaming: true,
  },

  reload: { configPrefixes: [`channels.${TELEGRAM_USERBOT_CHANNEL_ID}`] },

  // -------------------------------------------------------------------------
  // Adapters
  // -------------------------------------------------------------------------

  onboarding: telegramUserbotOnboardingAdapter,
  config: telegramUserbotConfigAdapter,
  setup: telegramUserbotSetupAdapter,
  auth: telegramUserbotAuthAdapter,
  status: telegramUserbotStatusAdapter,
  security: telegramUserbotSecurityAdapter,
  outbound: telegramUserbotOutboundAdapter,
  actions: telegramUserbotMessageActions,
  agentPrompt: telegramUserbotAgentPromptAdapter,
  streaming: telegramUserbotStreamingAdapter,
  directory: telegramUserbotDirectoryAdapter,
  threading: telegramUserbotThreadingAdapter,

  // -------------------------------------------------------------------------
  // Gateway — manages the MTProto connection lifecycle
  // -------------------------------------------------------------------------

  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      if (!account.configured) {
        throw new Error(
          `telegram-userbot is not configured for account "${account.accountId}" (need apiId and apiHash in channels.telegram-userbot).`,
        );
      }

      ctx.log?.info(
        `[${account.accountId}] starting telegram-userbot provider (apiId=${account.apiId})`,
      );

      const manager = new ConnectionManager({
        apiId: account.apiId,
        apiHash: account.apiHash,
        accountId: account.accountId,
        reconnect: account.config.reconnect,
      });

      connectionManagers.set(account.accountId, manager);

      // Track inbound handler cleanup for teardown.
      let inboundCleanup: (() => void) | null = null;

      // Wire connection events to the gateway status sink.
      manager.on("connected", ({ username, userId }: { username?: string; userId?: number }) => {
        ctx.log?.info(
          `[${account.accountId}] connected${username ? ` as @${username}` : ""}${userId ? ` (${userId})` : ""}`,
        );
        ctx.setStatus({
          accountId: account.accountId,
          connected: true,
          running: true,
          lastConnectedAt: Date.now(),
          lastError: null,
          profile: username ? { username, userId } : undefined,
        });

        // Register inbound handlers on first successful connection.
        if (!inboundCleanup && userId) {
          const client = manager.getClient();
          if (client) {
            ctx.log?.info(`[${account.accountId}] registering inbound message handlers`);
            inboundCleanup = registerInboundHandlers(client, {
              selfUserId: userId,
              allowFrom: account.config.allowFrom,
              onMessage: async (msg) => {
                await dispatchInboundMessage(msg, ctx);
              },
            });
          }
        }
      });

      manager.on("disconnected", ({ reason }: { reason: string }) => {
        ctx.log?.warn(`[${account.accountId}] disconnected: ${reason}`);
        ctx.setStatus({
          accountId: account.accountId,
          connected: false,
          lastDisconnect: { at: Date.now(), error: reason },
        });
      });

      manager.on("reconnecting", ({ attempt, delayMs }: { attempt: number; delayMs: number }) => {
        ctx.log?.info(
          `[${account.accountId}] reconnecting (attempt ${attempt}, delay ${delayMs}ms)`,
        );
        ctx.setStatus({
          accountId: account.accountId,
          reconnectAttempts: attempt,
        });
      });

      manager.on("authError", ({ error }: { error: Error }) => {
        ctx.log?.error(`[${account.accountId}] auth error: ${error.message}`);
        ctx.setStatus({
          accountId: account.accountId,
          connected: false,
          lastError: error.message,
        });
      });

      manager.on("alertNeeded", ({ failures }: { failures: number }) => {
        ctx.log?.warn(`[${account.accountId}] alert: ${failures} consecutive connection failures`);
      });

      // Set initial status
      ctx.setStatus({
        accountId: account.accountId,
        running: true,
        lastStartAt: Date.now(),
      });

      // Start connection
      await manager.start();

      // Wait until abort signal fires (gateway lifecycle).
      await new Promise<void>((resolve) => {
        if (ctx.abortSignal.aborted) {
          resolve();
          return;
        }
        ctx.abortSignal.addEventListener("abort", () => resolve(), { once: true });
      });

      // Cleanup on stop
      inboundCleanup?.();
      inboundCleanup = null;
      inboundFloodControllers.delete(account.accountId);
      await manager.stop();
      connectionManagers.delete(account.accountId);

      ctx.setStatus({
        accountId: account.accountId,
        running: false,
        connected: false,
        lastStopAt: Date.now(),
      });
    },

    stopAccount: async (ctx) => {
      const manager = connectionManagers.get(ctx.accountId);
      if (manager) {
        await manager.stop();
        connectionManagers.delete(ctx.accountId);
      }
    },
  },

  // -------------------------------------------------------------------------
  // Pairing
  // -------------------------------------------------------------------------

  pairing: {
    idLabel: "telegramUserbotSenderId",
    normalizeAllowEntry: (entry) => entry.replace(/^telegram-userbot:/i, "").trim(),
  },

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  messaging: {
    normalizeTarget: (raw) => {
      const trimmed = raw?.trim();
      if (!trimmed) return undefined;
      // Strip channel prefix if present
      return trimmed.replace(/^telegram-userbot:/i, "");
    },
    targetResolver: {
      looksLikeId: (raw) => {
        const trimmed = raw?.trim();
        if (!trimmed) return false;
        // Numeric IDs or @usernames
        return /^\d+$/.test(trimmed) || /^@\w+$/.test(trimmed);
      },
      hint: "<userId|@username>",
    },
  },
};

// ---------------------------------------------------------------------------
// Expose the ConnectionManager map for use by other adapters
// ---------------------------------------------------------------------------

export function getConnectionManager(accountId: string): ConnectionManager | undefined {
  return connectionManagers.get(accountId);
}
