import type { AvailableCommand } from "@agentclientprotocol/sdk";
import { t } from "../i18n/index.js";

export function getAvailableCommands(): AvailableCommand[] {
  return [
    { name: "help", description: "Show help and common commands." },
    { name: "commands", description: "List available commands." },
    { name: t("acp.commands.help"), description: "Show current status." },
    {
      name: "context",
      description: t("acp.commands.context"),
      input: { hint: "list | detail | json" },
    },
    { name: "whoami", description: "Show sender id (alias: /id)." },
    { name: "id", description: "Alias for /whoami." },
    { name: "subagents", description: "List or manage sub-agents." },
    { name: "config", description: "Read or write config (owner-only)." },
    { name: "debug", description: "Set runtime-only overrides (owner-only)." },
    { name: "usage", description: "Toggle usage footer (off|tokens|full)." },
    { name: "stop", description: "Stop the current run." },
    { name: "restart", description: "Restart the gateway (if enabled)." },
    { name: "dock-telegram", description: "Route replies to Telegram." },
    { name: "dock-discord", description: "Route replies to Discord." },
    { name: "dock-slack", description: "Route replies to Slack." },
    { name: "activation", description: "Set group activation (mention|always)." },
    { name: "send", description: "Set send mode (on|off|inherit)." },
    { name: "reset", description: "Reset the session (/new)." },
    { name: t("acp.commands.whoami"), description: "Reset the session (/reset)." },
    {
      name: "think",
      description: t("acp.commands.think"),
    },
    { name: "verbose", description: "Set verbose mode (on|full|off)." },
    { name: "reasoning", description: "Toggle reasoning output (on|off|stream)." },
    { name: "elevated", description: "Toggle elevated mode (on|off)." },
    { name: "model", description: "Select a model (list|status|<name>)." },
    { name: "queue", description: "Adjust queue mode and options." },
    { name: "bash", description: "Run a host command (if enabled)." },
    { name: t("acp.commands.verbose"), description: "Compact the session history." },
  ];
}
