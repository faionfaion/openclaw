import json

# Read the current en.json
with open("src/i18n/en.json", "r") as f:
    en_data = json.load(f)

# Read the acp commands
with open("acp_commands.json", "r") as f:
    acp_commands = json.load(f)

# Add commands to the acp section
en_data["acp"]["commands"] = acp_commands["commands"]

# Write back the updated en.json
with open("src/i18n/en.json", "w") as f:
    json.dump(en_data, f, indent=2, ensure_ascii=False)

print("Updated en.json with ACP commands")
