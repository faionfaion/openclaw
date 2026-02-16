import json
import re
import sys

def extract_placeholders(text):
    """Extract all {placeholder} patterns from text"""
    if not isinstance(text, str):
        return set()
    return set(re.findall(r"\{([^}]+)\}", text))

def get_placeholders_from_obj(obj, path=""):
    """Recursively extract placeholders from nested JSON"""
    placeholders = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            current_path = f"{path}.{key}" if path else key
            if isinstance(value, str):
                ph = extract_placeholders(value)
                if ph:
                    placeholders[current_path] = ph
            elif isinstance(value, dict):
                placeholders.update(get_placeholders_from_obj(value, current_path))
    return placeholders

# Read en.json as reference
with open("src/i18n/en.json", "r") as f:
    en_data = json.load(f)

en_placeholders = get_placeholders_from_obj(en_data)
print(f"Found {len(en_placeholders)} keys with placeholders in English")

# Check all other locale files
locale_files = ["de.json", "es.json", "fr.json", "pt.json", "ja.json", "zh.json", "pl.json", "tr.json", "uk.json"]

all_match = True
for locale_file in locale_files:
    with open(f"src/i18n/{locale_file}", "r") as f:
        locale_data = json.load(f)
    
    locale_placeholders = get_placeholders_from_obj(locale_data)
    
    mismatches = []
    for key, en_ph in en_placeholders.items():
        if key in locale_placeholders:
            locale_ph = locale_placeholders[key]
            if en_ph != locale_ph:
                mismatches.append({
                    "key": key,
                    "en": sorted(en_ph),
                    "locale": sorted(locale_ph)
                })
        else:
            # Key exists but has no placeholders in locale
            mismatches.append({
                "key": key,
                "en": sorted(en_ph),
                "locale": []
            })
    
    if mismatches:
        print(f"\n❌ {locale_file} - PLACEHOLDER MISMATCHES")
        for mismatch in mismatches:
            key = mismatch["key"]
            en_ph = mismatch["en"] 
            locale_ph = mismatch["locale"]
            print(f"  {key}: en={en_ph} vs locale={locale_ph}")
        all_match = False
    else:
        print(f"✅ {locale_file} - Placeholders match")

if all_match:
    print(f"\n✅ ALL PLACEHOLDERS MATCH ACROSS ALL LOCALES")
else:
    print(f"\n❌ PLACEHOLDER CHECK FAILED")
    sys.exit(1)
