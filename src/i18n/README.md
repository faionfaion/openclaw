# OpenClaw i18n (Internationalization)

Comprehensive localization system for OpenClaw supporting 10 languages with automatic locale detection.

## Supported Languages

| Code | Language             | Native Name       |
| ---- | -------------------- | ----------------- |
| `en` | English              | English (default) |
| `uk` | Ukrainian            | Українська        |
| `de` | German               | Deutsch           |
| `es` | Spanish              | Español           |
| `fr` | French               | Français          |
| `pt` | Portuguese           | Português         |
| `ja` | Japanese             | 日本語            |
| `zh` | Chinese (Simplified) | 简体中文          |
| `pl` | Polish               | Polski            |
| `tr` | Turkish              | Türkçe            |

## Project Structure

```
src/i18n/
├── index.ts           — Runtime: setLocale(), t(), detectLocale(), initializeLocale()
├── config-schema.md   — Configuration documentation
├── en.json            — English (default/fallback)
├── uk.json            — Ukrainian
├── de.json            — German
├── es.json            — Spanish
├── fr.json            — French
├── pt.json            — Portuguese
├── ja.json            — Japanese
├── zh.json            — Chinese (Simplified)
├── pl.json            — Polish
├── tr.json            — Turkish
└── README.md          — This file
```

## Configuration

Set your preferred language in `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "locale": "uk"
    }
  }
}
```

## Usage

### Basic Translation

```ts
import { setLocale, t } from "./i18n";

setLocale("uk");
console.log(t("commands.help.description")); // "Допомога та команди."
console.log(t("system.model_changed", { model: "gpt-4" })); // "Модель змінено на gpt-4."
```

### Automatic Locale Detection

```ts
import { initializeLocale, detectLocale } from "./i18n";

// Initialize from config and environment
initializeLocale(config);

// Or detect manually
const locale = detectLocale(config); // "uk", "de", "en", etc.
```

### Parameter Interpolation

```ts
t("system.model_changed", { model: "claude-4" });
// English: "Model changed to claude-4."
// Ukrainian: "Модель змінено на claude-4."
// German: "Modell geändert zu claude-4."
```

## Locale Detection Priority

1. **Configuration**: `agents.defaults.locale` in `openclaw.json`
2. **Environment**: `LANG`, `LC_ALL`, `LANGUAGE` environment variables
3. **Fallback**: English (`en`)

Example environment detection:

```bash
export LANG=uk_UA.UTF-8  # → "uk"
export LANG=de_DE.UTF-8  # → "de"
export LANG=ja_JP.UTF-8  # → "ja"
```

## Translation Coverage

All user-facing strings are localized, including:

### Command System

- Command descriptions (`/help`, `/status`, `/model`, etc.)
- Command help text and usage instructions
- Command category labels

### System Messages

- Session management ("Session reset", "New session started")
- Model switching ("Model changed to...", "Model set to...")
- Feature toggles ("Verbose mode enabled", "TTS activated")
- Error handling ("Not found", "No permission")

### Status Display

- Current status labels ("Model:", "Session:", "Queue:")
- Runtime information ("Connected", "Running", "Ready")
- Settings feedback ("Current thinking level: high")

### UI Components

- Action buttons ("Save", "Cancel", "Reset", "Update")
- Validation messages ("This field is required")
- Confirmation prompts ("Are you sure?")
- Form labels and hints

### TTS & Media

- TTS status messages
- Media processing feedback
- Voice synthesis notifications

## Key Namespaces

- `commands.*` — Command descriptions for /help and /commands
- `system.*` — System messages, errors, confirmations, feature toggles
- `status.*` — Status display labels and current state information
- `help.*` — Help system text and section headers
- `categories.*` — Command category labels
- `validation.*` — Form validation and error messages
- `actions.*` — UI action buttons and controls
- `prompts.*` — User prompts and confirmation dialogs
- `tts.*` — Text-to-speech related messages

## Adding a New Locale

1. **Create translation file**: Copy `en.json` → `{code}.json`
2. **Translate all values**: Maintain the same JSON structure, translate only the values
3. **Update index.ts**:
   - Import the new locale: `import newLang from "./newlang.json";`
   - Add to `Locale` type: `"newlang"`
   - Add to `locales` object: `newlang`
   - Add to `langMap` in `detectLocale()` if needed
   - Add to `getLocaleDisplayNames()`

4. **Test thoroughly**: Verify all UI elements render correctly in the new language

## Development Guidelines

### Translation Quality

- Use natural, idiomatic expressions in the target language
- Maintain consistent terminology across related strings
- Consider cultural context and local conventions
- Keep technical terms clear and accessible

### Parameter Handling

- Preserve `{parameter}` placeholders exactly as in English
- Adapt surrounding text to fit natural word order
- Test parameter interpolation with various values

### Fallback Strategy

- Missing translations automatically fall back to English
- Partial translations are supported (mix of localized and English strings)
- Invalid locale codes default to English

## Implementation Notes

- **Performance**: Locales are loaded once at startup and cached
- **Memory**: Only the active locale is kept in memory after initialization
- **Encoding**: All files use UTF-8 encoding for proper Unicode support
- **Validation**: Unknown locale codes throw descriptive errors
- **Thread Safety**: Translation functions are stateless and thread-safe after initialization
