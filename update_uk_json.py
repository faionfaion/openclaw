import json

# Read the current uk.json
with open("src/i18n/uk.json", "r") as f:
    uk_data = json.load(f)

# Read the Ukrainian ACP commands
with open("acp_commands_uk.json", "r") as f:
    acp_commands_uk = json.load(f)

# Add commands to the acp section
uk_data["acp"]["commands"] = acp_commands_uk["commands"]

# Write back the updated uk.json
with open("src/i18n/uk.json", "w") as f:
    json.dump(uk_data, f, indent=2, ensure_ascii=False)

print("Updated uk.json with Ukrainian ACP commands")
