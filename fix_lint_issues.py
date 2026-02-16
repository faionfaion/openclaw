#!/usr/bin/env python3
import os
import re

def fix_channel_access():
    """Fix the type definition in channel-access.ts"""
    file_path = "src/channels/plugins/onboarding/channel-access.ts"
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Replace the problematic type definition
    old_type = 'export type ChannelAccessPolicy = t("onboarding.channel_access.allowlist_recommended") | t("onboarding.channel_access.open_allow_all") | t("onboarding.channel_access.disabled_block_all");'
    new_type = 'export type ChannelAccessPolicy = "allowlist" | "open" | "disabled";'
    
    content = content.replace(old_type, new_type)
    
    # Fix the usage to use constants
    content = content.replace('t("onboarding.channel_access.allowlist_recommended")', '"allowlist"')
    content = content.replace('t("onboarding.channel_access.open_allow_all")', '"open"')
    content = content.replace('t("onboarding.channel_access.disabled_block_all")', '"disabled"')
    
    # Remove the import since we're no longer using t() in this file
    content = content.replace('import { t } from "../../../i18n/index.js";\n', '')
    
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"Fixed {file_path}")

def fix_cron_jobs():
    """Fix the type definition in cron jobs.ts"""
    file_path = "src/cron/service/jobs.ts"
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find the problematic line and replace it
    old_line = '  const next: Extract<CronPayload, { kind: t("cron.isolated_jobs_require_agent_turn") }> = { ...existing };'
    new_line = '  const next: Extract<CronPayload, { kind: "agentTurn" }> = { ...existing };'
    
    content = content.replace(old_line, new_line)
    
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"Fixed {file_path}")

def remove_unused_imports():
    """Remove unused t imports from files that don't use them"""
    files_with_unused_imports = [
        "src/commands/agents.command-shared.ts",
        "src/telegram/bot-access.ts", 
        "src/agents/tool-images.ts",
        "src/telegram/bot-native-command-menu.ts",
        "src/telegram/monitor.ts",
        "src/auto-reply/reply/directive-handling.impl.ts",
        "src/telegram/voice.ts",
        "src/telegram/bot-message-context.ts"
    ]
    
    for file_path in files_with_unused_imports:
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Remove the import line
            content = re.sub(r'import { t } from ["\'][^"\']+["\'];\n', '', content)
            
            with open(file_path, 'w') as f:
                f.write(content)
            print(f"Removed unused import from {file_path}")

def main():
    print("Fixing linting issues...")
    fix_channel_access()
    fix_cron_jobs()
    remove_unused_imports()
    print("Done!")

if __name__ == "__main__":
    main()
