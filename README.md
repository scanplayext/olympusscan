# Mangayomi iOS Extensions

Pure JavaScript Mangayomi extensions optimized for iPhone/iOS.

These sources do not use Dalvik, Android Proxy Server, Java, `127.0.0.1`, `localhost`, or any external proxy.

## Sources

- `Olympus Biblioteca`: manga/manhwa source for `https://olympusbiblioteca.com/`.
- `Stremio Bridge Direct`: anime/video source that reads Stremio addon manifests and only exposes direct HTTP(S) streams compatible with iOS.

## Files

```text
olympusbiblioteca/
  index.json
  anime_index.json
  repo.json
  anime/
    src/
      all/
        stremiobridge.js
  manga/
    src/
      es/
        olympusbiblioteca.js
  tools/
    smoke-test.mjs
    stremio-bridge-smoke-test.mjs
```

## Installation

### Olympus Biblioteca

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

Or install it as a repository with:

```text
https://raw.githubusercontent.com/scanplayext/olympusscan/main/index.json
```

### Stremio Bridge Direct

1. Open Mangayomi on iPhone.
2. Go to Extensions / Repositories.
3. Add this anime repository URL:

```text
https://raw.githubusercontent.com/scanplayext/olympusscan/main/anime_index.json
```

4. Install and enable `Stremio Bridge Direct`.
5. Open source settings:
   - `Catalog manifest URL`: defaults to official Cinemeta, which provides movies/series metadata.
   - `Stream manifest URLs`: paste one or more configured Stremio addon manifest URLs, separated by new lines or commas.
6. Use the source from Browse / Anime.

The bridge does not play torrents or magnets. For iOS, use Stremio addons that return direct `https://...m3u8`, `https://...mp4`, `https://...m4v`, or `https://...mov` stream URLs.

## How Olympus Works

- Popular: reads `https://olympusbiblioteca.com/api/rankings?page=N&period=monthly_ranking`.
- Latest updates: reads `https://olympusbiblioteca.com/api/new-chapters?page=N`.
- Search: uses `https://olympusbiblioteca.com/api/series/list` for fast text search and `https://olympusbiblioteca.com/api/series` for genre/status filtering.
- Details: reads `https://olympusbiblioteca.com/api/series/{slug}?type=comic`.
- Chapters: reads `https://dashboard.olympusbiblioteca.com/api/series/{slug}/chapters?type=comic&page=N&direction=desc`.
- Pages: reads `https://olympusbiblioteca.com/api/capitulo/{slug}/{chapterId}?type=comic` and returns direct WebP image URLs.

The extension sends an iOS Safari user agent and image referer headers so Olympus returns real chapter images instead of bot placeholders.

## How Stremio Bridge Works

- Reads a Stremio manifest from `/manifest.json`.
- Uses catalog endpoints like `/catalog/movie/top/skip=0.json`.
- Uses meta endpoints like `/meta/movie/tt1254207.json`.
- Builds movie entries as one playable episode and series entries as episode lists from `meta.videos`.
- Calls configured stream addons at `/stream/{type}/{videoId}.json`.
- Keeps only direct HTTP(S) `stream.url` values.
- Blocks `infoHash`, magnet/torrent fields, `externalUrl`, local/private network URLs, `localhost`, and `127.0.0.1`.
- Defaults to iOS-safe stream filtering, preferring HLS/MP4/M4V/MOV.

## Dependencies

None. Mangayomi provides `MProvider`, `Client`, and the JavaScript runtime.

## Local Smoke Test

Run this from the folder that contains `olympusbiblioteca`:

```bash
node olympusbiblioteca/tools/smoke-test.mjs
node olympusbiblioteca/tools/stremio-bridge-smoke-test.mjs
```

The Olympus test verifies popular, latest, detail, chapter list, page image extraction, and genre/status metadata against the live site.

The Stremio Bridge test verifies the anime repository metadata, blocks banned Android/local proxy patterns, and checks live Cinemeta catalog/meta endpoints.
