#!/usr/bin/env python3
import subprocess
import re
import os
import json

def read_en_json():
    """Read the en.json to understand the key mappings"""
    try:
        with open('src/i18n/en.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def get_file_diff(file_path):
    """Get the diff for a specific file"""
    try:
        result = subprocess.run(['git', 'diff', 'origin/main..feature/i18n-support', '--', file_path], 
                              capture_output=True, text=True)
        return result.stdout
    except:
        return ""

def extract_changes_from_diff(diff_content):
    """Extract the import and t() changes from diff"""
    import_pattern = r'^\+import { t } from ["\']([^"\']+)["\'];?$'
    t_call_pattern = r'^\+.*t\(["\']([^"\']+)["\']\)'
    
    imports = []
    t_calls = []
    
    for line in diff_content.split('\n'):
        line = line.strip()
        
        # Extract import statements
        import_match = re.match(import_pattern, line)
        if import_match:
            imports.append(import_match.group(1))
        
        # Extract t() calls  
        t_match = re.search(t_call_pattern, line)
        if t_match:
            t_calls.append(t_match.group(1))
    
    return imports, t_calls

def process_file(file_path):
    """Process a single file to apply i18n changes"""
    print(f"Processing {file_path}...")
    
    # Get the diff to understand what changes need to be made
    diff = get_file_diff(file_path)
    if not diff:
        print(f"  No diff found for {file_path}")
        return
    
    imports, t_calls = extract_changes_from_diff(diff)
    
    if not imports and not t_calls:
        print(f"  No i18n changes found in {file_path}")
        return
        
    # Read current version of the file
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        print(f"  Could not read {file_path}")
        return
    
    original_content = content
    
    # Add import if needed
    if imports:
        import_path = imports[0]  # Use the first import path found
        import_line = f'import {{ t }} from "{import_path}";'
        
        # Check if import already exists
        if 'import { t }' not in content:
            # Find the right place to add the import (after other imports)
            lines = content.split('\n')
            import_index = -1
            
            for i, line in enumerate(lines):
                if line.strip().startswith('import ') and 'from ' in line:
                    import_index = i
            
            if import_index >= 0:
                lines.insert(import_index + 1, import_line)
                content = '\n'.join(lines)
                print(f"  Added import: {import_line}")
    
    # Apply t() calls based on the pattern seen in the diff
    # This is more complex as we need to match the exact strings and their context
    
    # For now, let's handle this manually for accuracy
    # We can get the specific replacements from the diff
    
    replacements_made = []
    
    # Parse the diff for specific string replacements
    diff_lines = diff.split('\n')
    for i, line in enumerate(diff_lines):
        if line.startswith('-') and '"' in line and not line.startswith('---'):
            # This is a line being removed (old string)
            old_line = line[1:].strip()
            
            # Look for the corresponding + line (new string)
            if i + 1 < len(diff_lines):
                new_line = diff_lines[i + 1]
                if new_line.startswith('+') and 't(' in new_line:
                    new_content = new_line[1:].strip()
                    
                    # Extract the old string pattern and new t() pattern
                    old_string_match = re.search(r'"([^"]+)"', old_line)
                    t_call_match = re.search(r't\("([^"]+)"\)', new_content)
                    
                    if old_string_match and t_call_match:
                        old_string = old_string_match.group(1)
                        t_key = t_call_match.group(1)
                        
                        # Replace in content
                        old_pattern = f'"{old_string}"'
                        new_pattern = f't("{t_key}")'
                        
                        if old_pattern in content:
                            content = content.replace(old_pattern, new_pattern)
                            replacements_made.append(f'"{old_string}" -> t("{t_key}")')
                            print(f"  Replaced: {old_pattern} -> {new_pattern}")
    
    # Write the modified content back
    if content != original_content:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  Updated {file_path} with {len(replacements_made)} replacements")
        except:
            print(f"  Failed to write {file_path}")
    else:
        print(f"  No changes needed for {file_path}")

def main():
    # Read the list of files to process
    try:
        with open('files_to_process.txt', 'r') as f:
            files = [line.strip() for line in f if line.strip()]
    except:
        print("Could not read files_to_process.txt")
        return
    
    print(f"Processing {len(files)} files...")
    
    for file_path in files:
        if os.path.exists(file_path):
            process_file(file_path)
        else:
            print(f"File not found: {file_path}")

if __name__ == "__main__":
    main()
