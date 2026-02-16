import type { OpenClawConfig } from "../../../config/config.js";
import type { DmPolicy } from "../../../config/types.js";
import type { WizardPrompter } from "../../../wizard/prompts.js";
import type { ChannelOnboardingAdapter, ChannelOnboardingDmPolicy } from "../onboarding-types.js";
import { detectBinary } from "../../../commands/onboard-helpers.js";
import { t } from "../../../i18n/index.js";
import {
  listIMessageAccountIds,
  resolveDefaultIMessageAccountId,
  resolveIMessageAccount,
} from "../../../imessage/accounts.js";
import { normalizeIMessageHandle } from "../../../imessage/targets.js";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "../../../routing/session-key.js";
import { formatDocsLink } from "../../../terminal/links.js";
import { addWildcardAllowFrom, promptAccountId } from "./helpers.js";

const channel = "imessage" as const;

function setIMessageDmPolicy(cfg: OpenClawConfig, dmPolicy: DmPolicy) {
  const allowFrom =
    dmPolicy === "open" ? addWildcardAllowFrom(cfg.channels?.imessage?.allowFrom) : undefined;
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      imessage: {
        ...cfg.channels?.imessage,
        dmPolicy,
        ...(allowFrom ? { allowFrom } : {}),
      },
    },
  };
}

function setIMessageAllowFrom(
  cfg: OpenClawConfig,
  accountId: string,
  allowFrom: string[],
): OpenClawConfig {
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      ...cfg,
      channels: {
        ...cfg.channels,
        imessage: {
          ...cfg.channels?.imessage,
          allowFrom,
        },
      },
    };
  }
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      imessage: {
        ...cfg.channels?.imessage,
        accounts: {
          ...cfg.channels?.imessage?.accounts,
          [accountId]: {
            ...cfg.channels?.imessage?.accounts?.[accountId],
            allowFrom,
          },
        },
      },
    },
  };
}

function parseIMessageAllowFromInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function promptIMessageAllowFrom(params: {
  cfg: OpenClawConfig;
  prompter: WizardPrompter;
  accountId?: string;
}): Promise<OpenClawConfig> {
  const accountId =
    params.accountId && normalizeAccountId(params.accountId)
      ? (normalizeAccountId(params.accountId) ?? DEFAULT_ACCOUNT_ID)
      : resolveDefaultIMessageAccountId(params.cfg);
  const resolved = resolveIMessageAccount({ cfg: params.cfg, accountId });
  const existing = resolved.config.allowFrom ?? [];
  await params.prompter.note(
    [
      "Allowlist iMessage DMs by handle or chat target.",
      t("onboarding.imessage.allowlist_description"),
      "- +15555550123",
      "- user@example.com",
      "- chat_id:123",
      "- chat_guid:... or chat_identifier:...",
      t("onboarding.common.multiple_entries"),
      `Docs: ${formatDocsLink("/imessage", "imessage")}`,
    ].join("\n"),
    "iMessage allowlist",
  );
  const entry = await params.prompter.text({
    message: t("onboarding.imessage.allowfrom_message"),
    placeholder: "+15555550123, user@example.com, chat_id:123",
    initialValue: existing[0] ? String(existing[0]) : undefined,
    validate: (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) {
        return t("onboarding.validation.required");
      }
      const parts = parseIMessageAllowFromInput(raw);
      for (const part of parts) {
        if (part === "*") {
          continue;
        }
        if (part.toLowerCase().startsWith("chat_id:")) {
          const id = part.slice("chat_id:".length).trim();
          if (!/^\d+$/.test(id)) {
            return `Invalid chat_id: ${part}`;
          }
          continue;
        }
        if (part.toLowerCase().startsWith("chat_guid:")) {
          if (!part.slice("chat_guid:".length).trim()) {
            return t("onboarding.validation.invalid_chat_guid");
          }
          continue;
        }
        if (part.toLowerCase().startsWith("chat_identifier:")) {
          if (!part.slice("chat_identifier:".length).trim()) {
            return t("onboarding.validation.invalid_chat_identifier");
          }
          continue;
        }
        if (!normalizeIMessageHandle(part)) {
          return `Invalid handle: ${part}`;
        }
      }
      return undefined;
    },
  });
  const parts = parseIMessageAllowFromInput(String(entry));
  const unique = [...new Set(parts)];
  return setIMessageAllowFrom(params.cfg, accountId, unique);
}

const dmPolicy: ChannelOnboardingDmPolicy = {
  label: t("onboarding.imessage.label"),
  channel,
  policyKey: "channels.imessage.dmPolicy",
  allowFromKey: "channels.imessage.allowFrom",
  getCurrent: (cfg) => cfg.channels?.imessage?.dmPolicy ?? "pairing",
  setPolicy: (cfg, policy) => setIMessageDmPolicy(cfg, policy),
  promptAllowFrom: promptIMessageAllowFrom,
};

export const imessageOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async ({ cfg }) => {
    const configured = listIMessageAccountIds(cfg).some((accountId) => {
      const account = resolveIMessageAccount({ cfg, accountId });
      return Boolean(
        account.config.cliPath ||
        account.config.dbPath ||
        account.config.allowFrom ||
        account.config.service ||
        account.config.region,
      );
    });
    const imessageCliPath = cfg.channels?.imessage?.cliPath ?? "imsg";
    const imessageCliDetected = await detectBinary(imessageCliPath);
    return {
      channel,
      configured,
      statusLines: [
        `iMessage: ${configured ? "configured" : "needs setup"}`,
        `imsg: ${imessageCliDetected ? t("onboarding.imessage.imsg_found") : "missing"} (${imessageCliPath})`,
      ],
      selectionHint: imessageCliDetected ? "imsg found" : "imsg missing",
      quickstartScore: imessageCliDetected ? 1 : 0,
    };
  },
  configure: async ({ cfg, prompter, accountOverrides, shouldPromptAccountIds }) => {
    const imessageOverride = accountOverrides.imessage?.trim();
    const defaultIMessageAccountId = resolveDefaultIMessageAccountId(cfg);
    let imessageAccountId = imessageOverride
      ? normalizeAccountId(imessageOverride)
      : defaultIMessageAccountId;
    if (shouldPromptAccountIds && !imessageOverride) {
      imessageAccountId = await promptAccountId({
        cfg,
        prompter,
        label: t("onboarding.imessage.label"),
        currentId: imessageAccountId,
        listAccountIds: listIMessageAccountIds,
        defaultAccountId: defaultIMessageAccountId,
      });
    }

    let next = cfg;
    const resolvedAccount = resolveIMessageAccount({
      cfg: next,
      accountId: imessageAccountId,
    });
    let resolvedCliPath = resolvedAccount.config.cliPath ?? "imsg";
    const cliDetected = await detectBinary(resolvedCliPath);
    if (!cliDetected) {
      const entered = await prompter.text({
        message: t("onboarding.imessage.cli_path_message"),
        initialValue: resolvedCliPath,
        validate: (value) => (value?.trim() ? undefined : t("onboarding.validation.required")),
      });
      resolvedCliPath = String(entered).trim();
      if (!resolvedCliPath) {
        await prompter.note(
          "imsg CLI path required to enable iMessage.",
          t("onboarding.imessage.label"),
        );
      }
    }

    if (resolvedCliPath) {
      if (imessageAccountId === DEFAULT_ACCOUNT_ID) {
        next = {
          ...next,
          channels: {
            ...next.channels,
            imessage: {
              ...next.channels?.imessage,
              enabled: true,
              cliPath: resolvedCliPath,
            },
          },
        };
      } else {
        next = {
          ...next,
          channels: {
            ...next.channels,
            imessage: {
              ...next.channels?.imessage,
              enabled: true,
              accounts: {
                ...next.channels?.imessage?.accounts,
                [imessageAccountId]: {
                  ...next.channels?.imessage?.accounts?.[imessageAccountId],
                  enabled: next.channels?.imessage?.accounts?.[imessageAccountId]?.enabled ?? true,
                  cliPath: resolvedCliPath,
                },
              },
            },
          },
        };
      }
    }

    await prompter.note(
      [
        "This is still a work in progress.",
        "Ensure OpenClaw has Full Disk Access to Messages DB.",
        "Grant Automation permission for Messages when prompted.",
        t("onboarding.imessage.setup_tips"),
        `Docs: ${formatDocsLink("/imessage", "imessage")}`,
      ].join("\n"),
      "iMessage next steps",
    );

    return { cfg: next, accountId: imessageAccountId };
  },
  dmPolicy,
  disable: (cfg) => ({
    ...cfg,
    channels: {
      ...cfg.channels,
      imessage: { ...cfg.channels?.imessage, enabled: false },
    },
  }),
};
