# Olympus Biblioteca for Mangayomi iOS

Pure JavaScript Mangayomi manga extension for `https://olympusbiblioteca.com/`.

This source is designed for iPhone/iOS Mangayomi. It does not use Dalvik, Android Proxy Server, Java, `127.0.0.1`, `localhost`, or any external proxy.

## Files

```text
olympusbiblioteca/
  index.json
  repo.json
  manga/
    src/
      es/
        olympusbiblioteca.js
  tools/
    smoke-test.mjs
```

## Installation

### Option A: Paste as a custom JavaScript source

1. Open Mangayomi on iPhone.
2. Go to Browse or Extensions.
3. Add a custom source.
4. Use these fields:
   - Name: `Olympus Biblioteca`
   - Base URL: `https://olympusbiblioteca.com`
   - API URL: `https://dashboard.olympusbiblioteca.com/api`
   - Language: `es`
   - Type: Manga
   - Source language: JavaScript
5. Paste the contents of `manga/src/es/olympusbiblioteca.js`.
6. Save, enable the source, then open it from Browse.

### Option B: Install as a repository

1. Upload this folder to a GitHub repository or another HTTPS host.
2. Edit `index.json` and replace `sourceCodeUrl` with the raw HTTPS URL to `manga/src/es/olympusbiblioteca.js`.
3. In Mangayomi on iPhone, add the raw HTTPS URL to `index.json` as an extension repository.
4. Install and enable `Olympus Biblioteca`.

## How It Works

- Popular: reads `https://olympusbiblioteca.com/api/rankings?page=N&period=monthly_ranking`.
- Latest updates: reads `https://olympusbiblioteca.com/api/new-chapters?page=N`.
- Search: uses `https://olympusbiblioteca.com/api/series/list` for fast text search and `https://olympusbiblioteca.com/api/series` for genre/status filtering.
- Details: reads `https://olympusbiblioteca.com/api/series/{slug}?type=comic`.
- Chapters: reads `https://dashboard.olympusbiblioteca.com/api/series/{slug}/chapters?type=comic&page=N&direction=desc`.
- Pages: reads `https://olympusbiblioteca.com/api/capitulo/{slug}/{chapterId}?type=comic` and returns direct WebP image URLs.

The extension sends an iOS Safari user agent and image referer headers so Olympus returns real chapter images instead of bot placeholders.

## Dependencies

None. Mangayomi provides `MProvider`, `Client`, and the JavaScript runtime.

## Local Smoke Test

Run this from the folder that contains `olympusbiblioteca`:

```bash
node olympusbiblioteca/tools/smoke-test.mjs
```

The test verifies popular, latest, detail, chapter list, page image extraction, and genre/status metadata against the live site.
