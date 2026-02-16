import json
import os

# List of locale files to update (excluding en.json and uk.json which we already did)
locales = ["de.json", "es.json", "fr.json", "pt.json", "ja.json", "zh.json", "pl.json", "tr.json"]

# Read the English ACP commands
with open("acp_commands.json", "r") as f:
    acp_commands = json.load(f)

for locale_file in locales:
    locale_path = f"src/i18n/{locale_file}"
    
    # Read the current locale file
    with open(locale_path, "r") as f:
        locale_data = json.load(f)
    
    # Ensure acp section exists
    if "acp" not in locale_data:
        locale_data["acp"] = {}
    
    # Add English fallback commands to the acp section
    locale_data["acp"]["commands"] = acp_commands["commands"]
    
    # Write back the updated locale file
    with open(locale_path, "w") as f:
        json.dump(locale_data, f, indent=2, ensure_ascii=False)
    
    print(f"Updated {locale_file} with English ACP commands fallback")

print("All locale files updated!")
