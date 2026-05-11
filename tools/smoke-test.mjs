const BASE_URL = "https://olympusbiblioteca.com";
const API_URL = "https://dashboard.olympusbiblioteca.com/api";
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function json(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json, text/plain, */*",
      "Referer": `${BASE_URL}/`,
      "Origin": BASE_URL
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response.json();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const popular = await json(`${BASE_URL}/api/rankings?page=1&period=monthly_ranking`);
assert(Array.isArray(popular.data) && popular.data.length > 0, "popular list is empty");

const latest = await json(`${BASE_URL}/api/new-chapters?page=1`);
assert(Array.isArray(latest.data) && latest.data.length > 0, "latest list is empty");

const first = latest.data.find(item => item.type === "comic" && item.last_chapters && item.last_chapters.length > 0);
assert(first, "latest list did not include a comic with chapters");

const detail = await json(`${BASE_URL}/api/series/${encodeURIComponent(first.slug)}?type=comic`);
assert(detail.data && detail.data.name, "detail response is missing title");

const chapters = await json(`${API_URL}/series/${encodeURIComponent(first.slug)}/chapters?type=comic&page=1&direction=desc`);
assert(Array.isArray(chapters.data) && chapters.data.length > 0, "chapter list is empty");

const chapter = chapters.data[0];
const pages = await json(`${BASE_URL}/api/capitulo/${encodeURIComponent(first.slug)}/${chapter.id}?type=comic`);
assert(pages.chapter && Array.isArray(pages.chapter.pages) && pages.chapter.pages.length > 0, "page list is empty");

const filters = await json(`${BASE_URL}/api/genres-statuses`);
assert(Array.isArray(filters.genres) && filters.genres.length > 0, "genre list is empty");
assert(Array.isArray(filters.statuses) && filters.statuses.length > 0, "status list is empty");

console.log(JSON.stringify({
  ok: true,
  popular: popular.data.length,
  latest: latest.data.length,
  detail: detail.data.name,
  chapters: chapters.data.length,
  pages: pages.chapter.pages.length,
  genres: filters.genres.length,
  statuses: filters.statuses.length
}, null, 2));
