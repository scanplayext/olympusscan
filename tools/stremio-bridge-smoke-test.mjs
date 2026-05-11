import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const sourceUrl = new URL("anime/src/all/stremiobridge.js", root);
const indexUrl = new URL("anime_index.json", root);
const source = await readFile(sourceUrl, "utf8");
const index = JSON.parse(await readFile(indexUrl, "utf8"));

const banned = [
  "dalvik",
  "Android Proxy",
  "magnet:?xt=urn:btih"
];

for (const token of banned) {
  if (source.includes(token)) {
    throw new Error(`Banned token found in anime source: ${token}`);
  }
}

const localhostRequestPatterns = [
  "http://127.",
  "https://127.",
  "http://localhost",
  "https://localhost"
];

for (const token of localhostRequestPatterns) {
  if (source.includes(token)) {
    throw new Error(`Localhost request pattern found in anime source: ${token}`);
  }
}

if (!Array.isArray(index) || index[0]?.itemType !== 1 || index[0]?.isManga !== false) {
  throw new Error("anime_index.json does not describe an anime source.");
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    }
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

const manifest = await getJson("https://v3-cinemeta.strem.io/manifest.json");
if (!manifest.resources?.includes("catalog") || !manifest.resources?.includes("meta")) {
  throw new Error("Cinemeta manifest no longer exposes catalog/meta resources.");
}

const catalog = await getJson("https://v3-cinemeta.strem.io/catalog/movie/top/skip=0.json");
if (!Array.isArray(catalog.metas) || catalog.metas.length === 0) {
  throw new Error("Cinemeta popular catalog returned no metas.");
}

const first = catalog.metas.find(item => item?.id && item?.type) || catalog.metas[0];
const meta = await getJson(`https://v3-cinemeta.strem.io/meta/${first.type}/${first.id}.json`);
if (!meta.meta?.name) {
  throw new Error("Cinemeta meta lookup returned no title.");
}

console.log(`OK Stremio Bridge smoke test: ${catalog.metas.length} popular items, first detail "${meta.meta.name}".`);
