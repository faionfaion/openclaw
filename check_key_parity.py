import json
import sys

def get_all_keys(obj, prefix=""):
    """Recursively extract all keys from nested JSON object"""
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            current_path = f"{prefix}.{key}" if prefix else key
            keys.add(current_path)
            if isinstance(value, dict):
                keys.update(get_all_keys(value, current_path))
    return keys

# Read en.json as reference
with open("src/i18n/en.json", "r") as f:
    en_data = json.load(f)

en_keys = get_all_keys(en_data)
print(f"English keys count: {len(en_keys)}")

# Check all other locale files
locale_files = ["de.json", "es.json", "fr.json", "pt.json", "ja.json", "zh.json", "pl.json", "tr.json", "uk.json"]

all_match = True
for locale_file in locale_files:
    with open(f"src/i18n/{locale_file}", "r") as f:
        locale_data = json.load(f)
    
    locale_keys = get_all_keys(locale_data)
    
    missing_keys = en_keys - locale_keys
    extra_keys = locale_keys - en_keys
    
    if missing_keys or extra_keys:
        print(f"\n❌ {locale_file} - KEY MISMATCH")
        if missing_keys:
            print(f"  Missing keys: {sorted(missing_keys)}")
        if extra_keys:
            print(f"  Extra keys: {sorted(extra_keys)}")
        all_match = False
    else:
        print(f"✅ {locale_file} - Keys match ({len(locale_keys)} keys)")

if all_match:
    print(f"\n✅ ALL LOCALE FILES HAVE MATCHING KEYS ({len(en_keys)} keys each)")
else:
    print(f"\n❌ KEY PARITY CHECK FAILED")
    sys.exit(1)
