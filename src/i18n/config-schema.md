# OpenClaw i18n Configuration

OpenClaw supports internationalization (i18n) with localized user interface strings. You can configure the locale in your `openclaw.json` configuration file.

## Supported Languages

- **English** (`en`) - Default
- **Ukrainian** (`uk`) - Українська
- **German** (`de`) - Deutsch
- **Spanish** (`es`) - Español
- **French** (`fr`) - Français
- **Portuguese** (`pt`) - Português
- **Japanese** (`ja`) - 日本語
- **Chinese Simplified** (`zh`) - 简体中文
- **Polish** (`pl`) - Polski
- **Turkish** (`tr`) - Türkçe

## Configuration

Add the `locale` setting to your agent defaults in `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "locale": "uk"
    }
  }
}
```

## Locale Detection Priority

OpenClaw detects the locale in the following order:

1. **Configuration file** - `agents.defaults.locale` in `openclaw.json`
2. **System environment** - `LANG`, `LC_ALL`, or `LANGUAGE` environment variables
3. **Default fallback** - English (`en`)

## Examples

### Ukrainian

```json
{
  "agents": {
    "defaults": {
      "locale": "uk"
    }
  }
}
```

### German

```json
{
  "agents": {
    "defaults": {
      "locale": "de"
    }
  }
}
```

### Japanese

```json
{
  "agents": {
    "defaults": {
      "locale": "ja"
    }
  }
}
```

## Environment Variables

You can also set the locale via environment variables:

```bash
export LANG=uk_UA.UTF-8
export LC_ALL=uk_UA.UTF-8
```

or

```bash
export LANG=de_DE.UTF-8
```

The language code before the underscore (`uk`, `de`, etc.) will be used to determine the locale.

## Localized Strings

When a locale is set, all user-facing messages will be displayed in that language, including:

- Command descriptions and help text
- Status messages and system notifications
- Error messages and warnings
- UI prompts and confirmations
- Model and session status displays
- Configuration updates and feedback

## Implementation Notes

- Locales are loaded at runtime and cached for performance
- Missing translations fall back to English automatically
- Parameter interpolation (e.g., `{model}`, `{level}`) is supported in all locales
- New locales can be added by creating translation files in `src/i18n/`
