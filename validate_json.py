import json
import os

def validate_json_file(file_path):
    try:
        with open(file_path, "r") as f:
            json.load(f)
        return True, None
    except json.JSONDecodeError as e:
        return False, str(e)

# List of JSON files to validate
json_files = [
    "src/i18n/en.json",
    "src/i18n/uk.json", 
    "src/i18n/de.json",
    "src/i18n/es.json",
    "src/i18n/fr.json",
    "src/i18n/pt.json",
    "src/i18n/ja.json",
    "src/i18n/zh.json",
    "src/i18n/pl.json",
    "src/i18n/tr.json"
]

all_valid = True
for json_file in json_files:
    if os.path.exists(json_file):
        is_valid, error = validate_json_file(json_file)
        if is_valid:
            print(f"✓ {json_file} - Valid JSON")
        else:
            print(f"✗ {json_file} - Invalid JSON: {error}")
            all_valid = False
    else:
        print(f"! {json_file} - File not found")
        all_valid = False

if all_valid:
    print("\n✅ All JSON files are valid!")
else:
    print("\n❌ Some JSON files have errors!")
