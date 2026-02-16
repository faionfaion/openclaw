import json
import re
import os

# Load en.json keys
with open('src/i18n/en.json') as f:
    en_data = json.load(f)

def get_all_keys(obj, prefix=''):
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f'{prefix}.{key}' if prefix else key
            keys.add(full_key)
            if isinstance(value, dict):
                keys.update(get_all_keys(value, full_key))
    return keys

valid_keys = get_all_keys(en_data)

# Sample files to check
sample_files = [
    'src/agents/apply-patch.ts',
    'src/commands/uninstall.ts', 
    'src/auto-reply/reply/commands-info.ts',
    'src/telegram/bot-native-commands.ts',
    'src/tts/tts-core.ts'
]

print('Checking t() key validity in sample files...')
valid_count = 0
invalid_count = 0

for file_path in sample_files:
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Look for t() calls
        for line_num, line in enumerate(content.split('\n'), 1):
            if 't(' in line:
                # Extract keys using simple string parsing
                import re
                matches = re.findall(r't\(["\'](.*?)["\']', line)
                for key in matches:
                    if key in valid_keys:
                        print(f'✅ {file_path}:{line_num} t("{key}") - VALID')
                        valid_count += 1
                    else:
                        print(f'❌ {file_path}:{line_num} t("{key}") - INVALID KEY')
                        invalid_count += 1

print(f'\nSummary: {valid_count} valid, {invalid_count} invalid t() calls')
