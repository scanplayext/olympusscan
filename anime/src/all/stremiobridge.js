const mangayomiSources = [
    {
        "name": "Stremio Bridge Direct",
        "id": 928410663,
        "baseUrl": "https://v3-cinemeta.strem.io",
        "apiUrl": "",
        "lang": "all",
        "typeSource": "single",
        "iconUrl": "https://www.stremio.com/website/stremio-logo-small.png",
        "itemType": 1,
        "isManga": false,
        "isNsfw": false,
        "version": "0.1.0",
        "dateFormat": "",
        "dateFormatLocale": "",
        "pkgPath": "anime/src/all/stremiobridge.js",
        "pkgName": "anime/src/all/stremiobridge.js"
    }
];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.manifestCache = {};
        this.manifestCacheTime = {};
        this.manifestCacheTtlMs = 1000 * 60 * 15;
        this.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    }

    get supportsLatest() {
        return true;
    }

    getHeaders() {
        return {
            "User-Agent": this.userAgent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
        };
    }

    async getPopular(page) {
        try {
            const settings = this.readSettings();
            const manifest = await this.getManifest(settings.catalogManifestUrl);
            const catalog = this.chooseCatalog(manifest, settings.mediaType, settings.popularCatalogId, false, false);
            if (!catalog) {
                return this.emptyPage();
            }

            const extra = this.catalogExtra(catalog, page, settings.catalogGenre, false);
            const url = this.resourceUrl(settings.catalogBaseUrl, "catalog", catalog.type, catalog.id, extra);
            return this.parseCatalogResponse(await this.requestJson(url), settings.catalogBaseUrl, catalog.type);
        } catch (error) {
            return this.emptyPage();
        }
    }

    async getLatestUpdates(page) {
        try {
            const settings = this.readSettings();
            const manifest = await this.getManifest(settings.catalogManifestUrl);
            const catalog = this.chooseCatalog(manifest, settings.mediaType, "year", false, true) ||
                this.chooseCatalog(manifest, settings.mediaType, settings.popularCatalogId, false, false);
            if (!catalog) {
                return this.emptyPage();
            }

            const extra = this.catalogExtra(catalog, page, settings.catalogGenre || String(new Date().getFullYear()), false);
            const url = this.resourceUrl(settings.catalogBaseUrl, "catalog", catalog.type, catalog.id, extra);
            return this.parseCatalogResponse(await this.requestJson(url), settings.catalogBaseUrl, catalog.type);
        } catch (error) {
            return this.emptyPage();
        }
    }

    async search(query, page, filters) {
        try {
            const settings = this.readSettings();
            const selected = this.readFilters(filters, settings);
            const manifest = await this.getManifest(settings.catalogManifestUrl);
            const needsSearch = this.cleanText(query).length > 0;
            const catalog = this.chooseCatalog(manifest, selected.mediaType, selected.catalogId, needsSearch, selected.catalogId === "year") ||
                this.chooseCatalog(manifest, selected.mediaType, "top", needsSearch, false);
            if (!catalog) {
                return this.emptyPage();
            }

            const extra = this.catalogExtra(catalog, page, selected.genre, needsSearch ? query : "");
            const url = this.resourceUrl(settings.catalogBaseUrl, "catalog", catalog.type, catalog.id, extra);
            return this.parseCatalogResponse(await this.requestJson(url), settings.catalogBaseUrl, catalog.type);
        } catch (error) {
            return this.emptyPage();
        }
    }

    async getDetail(url) {
        const ref = this.unpackRef(url);
        const baseUrl = ref.metaBase || this.readSettings().catalogBaseUrl;
        const type = ref.type || "movie";
        const id = ref.id || "";
        if (!id) {
            return {};
        }

        const meta = await this.loadMeta(baseUrl, type, id);
        if (!meta) {
            return {};
        }

        const episodes = this.episodesFromMeta(meta, baseUrl);
        return {
            name: this.cleanText(meta.name),
            link: url,
            imageUrl: this.bestPoster(meta, "large"),
            author: this.joinNames(meta.director),
            artist: this.joinNames(meta.cast),
            description: this.detailDescription(meta),
            genre: meta.genres || meta.genre || [],
            genres: meta.genres || meta.genre || [],
            status: this.statusFromMeta(meta),
            episodes
        };
    }

    async getVideoList(url) {
        const ref = this.unpackRef(url);
        const settings = this.readSettings();
        const type = ref.type || "movie";
        const id = ref.id || ref.parentId || "";
        const providers = this.videoProviderUrls(ref, settings);
        const videos = [];
        const seen = {};

        if (!id || providers.length === 0) {
            return videos;
        }

        for (const manifestUrl of providers) {
            const baseUrl = this.manifestBaseUrl(manifestUrl);
            if (!baseUrl || this.isLocalUrl(baseUrl)) {
                continue;
            }

            let manifest = null;
            try {
                manifest = await this.getManifest(manifestUrl);
            } catch (error) {
                manifest = null;
            }
            if (manifest && !this.manifestHasResource(manifest, "stream")) {
                continue;
            }

            try {
                const streamUrl = this.resourceUrl(baseUrl, "stream", type, id, null);
                const json = await this.requestJson(streamUrl);
                const streams = json && Array.isArray(json.streams) ? json.streams : [];
                const addonName = manifest && manifest.name ? manifest.name : this.hostLabel(baseUrl);

                for (const stream of streams) {
                    const video = this.videoFromStream(stream, addonName, settings);
                    if (!video || seen[video.url]) {
                        continue;
                    }
                    seen[video.url] = true;
                    videos.push(video);
                    if (settings.maxStreams !== "all" && videos.length >= Number(settings.maxStreams || 20)) {
                        return this.sortVideos(videos);
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return this.sortVideos(videos);
    }

    getFilterList() {
        return [
            {
                type_name: "HeaderFilter",
                name: "Stremio Bridge: filters apply to search."
            },
            {
                type_name: "SelectFilter",
                type: "MediaTypeFilter",
                name: "Type",
                state: 0,
                values: [
                    {
                        type_name: "SelectOption",
                        name: "Movie",
                        value: "movie"
                    },
                    {
                        type_name: "SelectOption",
                        name: "Series",
                        value: "series"
                    }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "CatalogFilter",
                name: "Catalog",
                state: 0,
                values: [
                    {
                        type_name: "SelectOption",
                        name: "Popular",
                        value: "top"
                    },
                    {
                        type_name: "SelectOption",
                        name: "Featured",
                        value: "imdbRating"
                    },
                    {
                        type_name: "SelectOption",
                        name: "Year / New",
                        value: "year"
                    }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "GenreFilter",
                name: "Genre",
                state: 0,
                values: this.genreOptions().map(item => ({
                    type_name: "SelectOption",
                    name: item[0],
                    value: item[1]
                }))
            }
        ];
    }

    getSourcePreferences() {
        return [
            {
                "key": "stremio_catalog_manifest_url",
                "editTextPreference": {
                    "title": "Catalog manifest URL",
                    "summary": "Default uses official Cinemeta metadata/catalogs.",
                    "value": "https://v3-cinemeta.strem.io/manifest.json",
                    "dialogTitle": "Catalog manifest URL",
                    "dialogMessage": "Paste a public Stremio manifest URL that provides catalog/meta resources."
                }
            },
            {
                "key": "stremio_stream_manifest_urls",
                "editTextPreference": {
                    "title": "Stream manifest URLs",
                    "summary": "One or more Stremio stream manifests, separated by new lines or commas. Direct HTTP(S) streams only.",
                    "value": "",
                    "dialogTitle": "Stream manifest URLs",
                    "dialogMessage": "Paste configured Stremio addon manifest URLs. Torrent/magnet/infoHash/local streams are always ignored."
                }
            },
            {
                "key": "stremio_catalog_type",
                "listPreference": {
                    "title": "Default content type",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": [
                        "Movies",
                        "Series"
                    ],
                    "entryValues": [
                        "movie",
                        "series"
                    ]
                }
            },
            {
                "key": "stremio_popular_catalog_id",
                "listPreference": {
                    "title": "Popular catalog",
                    "summary": "",
                    "valueIndex": 0,
                    "entries": [
                        "Popular",
                        "Featured",
                        "Year / New"
                    ],
                    "entryValues": [
                        "top",
                        "imdbRating",
                        "year"
                    ]
                }
            },
            {
                "key": "stremio_catalog_genre",
                "listPreference": {
                    "title": "Default genre/category",
                    "summary": "Used by catalog pages when the selected catalog supports genres.",
                    "valueIndex": 0,
                    "entries": this.genreOptions().map(item => item[0]),
                    "entryValues": this.genreOptions().map(item => item[1])
                }
            },
            {
                "key": "stremio_max_streams",
                "listPreference": {
                    "title": "Max streams",
                    "summary": "Lower values make video loading faster on iPhone.",
                    "valueIndex": 2,
                    "entries": [
                        "5",
                        "10",
                        "20",
                        "All"
                    ],
                    "entryValues": [
                        "5",
                        "10",
                        "20",
                        "all"
                    ]
                }
            },
            {
                "key": "stremio_strict_ios_streams",
                "switchPreferenceCompat": {
                    "title": "Prefer iOS-safe streams",
                    "summary": "Only show likely playable HLS/MP4/M4V/MOV direct streams.",
                    "value": true
                }
            },
            {
                "key": "stremio_allow_http_streams",
                "switchPreferenceCompat": {
                    "title": "Allow non-HTTPS streams",
                    "summary": "Disabled by default for iOS compatibility and privacy.",
                    "value": false
                }
            }
        ];
    }

    async loadMeta(baseUrl, type, id) {
        const metaUrl = this.resourceUrl(baseUrl, "meta", type, id, null);
        try {
            const json = await this.requestJson(metaUrl);
            return json && json.meta ? json.meta : null;
        } catch (error) {
            if (baseUrl !== this.source.baseUrl) {
                try {
                    const fallback = await this.requestJson(this.resourceUrl(this.source.baseUrl, "meta", type, id, null));
                    return fallback && fallback.meta ? fallback.meta : null;
                } catch (fallbackError) {
                    return null;
                }
            }
            return null;
        }
    }

    episodesFromMeta(meta, baseUrl) {
        const type = meta.type === "show" ? "series" : (meta.type || "movie");
        const videos = Array.isArray(meta.videos) ? meta.videos : [];
        if (type === "series" || videos.length > 0) {
            const now = Date.now();
            return videos
                .filter(video => {
                    const date = video.firstAired || video.released;
                    if (!date) {
                        return true;
                    }
                    const millis = new Date(date).valueOf();
                    return Number.isNaN(millis) || millis <= now;
                })
                .map(video => {
                    const season = video.season || "";
                    const episode = video.number || video.episode || "";
                    const title = this.cleanText(video.name || video.title || `Episode ${episode}`);
                    return {
                        name: `S${season}:E${episode} - ${title}`,
                        url: this.packRef({
                            kind: "stream",
                            metaBase: baseUrl,
                            type: "series",
                            id: video.id || meta.id,
                            parentId: meta.id
                        }),
                        dateUpload: this.toDateUpload(video.firstAired || video.released),
                        thumbnailUrl: this.normalizeImageUrl(video.thumbnail || meta.poster || ""),
                        description: this.cleanText(video.description || video.overview || "")
                    };
                })
                .sort((a, b) => this.episodeSortValue(b.name) - this.episodeSortValue(a.name));
        }

        return [
            {
                name: meta.runtime ? `Movie - ${meta.runtime}` : "Movie",
                url: this.packRef({
                    kind: "stream",
                    metaBase: baseUrl,
                    type: "movie",
                    id: meta.id || meta.imdb_id
                }),
                dateUpload: this.toDateUpload(meta.released)
            }
        ];
    }

    episodeSortValue(name) {
        const match = String(name || "").match(/S(\d+):E(\d+)/);
        if (!match) {
            return 0;
        }
        return Number(match[1]) * 10000 + Number(match[2]);
    }

    async getManifest(manifestUrl) {
        const normalized = this.manifestUrl(manifestUrl);
        const now = Date.now();
        if (this.manifestCache[normalized] && now - this.manifestCacheTime[normalized] < this.manifestCacheTtlMs) {
            return this.manifestCache[normalized];
        }

        const json = await this.requestJson(normalized);
        this.manifestCache[normalized] = json;
        this.manifestCacheTime[normalized] = now;
        return json;
    }

    async requestJson(url) {
        if (!url || this.isLocalUrl(url)) {
            throw new Error(`Blocked local or empty URL: ${url}`);
        }
        const response = await this.client.get(url, this.getHeaders());
        if (!response || !response.body) {
            throw new Error(`Empty Stremio response: ${url}`);
        }
        return JSON.parse(response.body);
    }

    parseCatalogResponse(json, baseUrl, fallbackType) {
        const metas = json && Array.isArray(json.metas) ? json.metas : [];
        return {
            list: metas.map(meta => this.itemFromMeta(meta, baseUrl, fallbackType)).filter(Boolean),
            hasNextPage: Boolean(json && (json.hasMore || json.hasNextPage))
        };
    }

    itemFromMeta(meta, baseUrl, fallbackType) {
        const id = meta && (meta.id || meta.imdb_id);
        if (!meta || !id || !meta.name) {
            return null;
        }
        const type = meta.type === "show" ? "series" : (meta.type || fallbackType || "movie");
        return {
            name: this.cleanText(meta.name),
            imageUrl: this.bestPoster(meta, "medium"),
            link: this.packRef({
                kind: "meta",
                metaBase: baseUrl,
                type,
                id
            }),
            description: this.cleanText(meta.description || meta.releaseInfo || meta.year || ""),
            genre: meta.genres || meta.genre || []
        };
    }

    chooseCatalog(manifest, mediaType, preferredId, needsSearch, preferGenreRequired) {
        const catalogs = manifest && Array.isArray(manifest.catalogs) ? manifest.catalogs : [];
        const candidates = catalogs.filter(catalog => {
            if (!catalog || catalog.type !== mediaType) {
                return false;
            }
            if (needsSearch && !this.catalogSupports(catalog, "search")) {
                return false;
            }
            if (preferGenreRequired && !this.catalogSupports(catalog, "genre")) {
                return false;
            }
            return this.hasOnlySupportedRequirements(catalog);
        });

        return candidates.find(catalog => catalog.id === preferredId) ||
            candidates.find(catalog => catalog.id === "top") ||
            candidates[0] ||
            null;
    }

    hasOnlySupportedRequirements(catalog) {
        const required = catalog.extraRequired || [];
        for (const item of required) {
            if (item !== "genre" && item !== "search" && item !== "skip") {
                return false;
            }
        }
        const extra = catalog.extra || [];
        for (const item of extra) {
            if (item && item.isRequired && item.name !== "genre" && item.name !== "search" && item.name !== "skip") {
                return false;
            }
        }
        return true;
    }

    catalogSupports(catalog, name) {
        const supported = catalog.extraSupported || [];
        if (supported.indexOf(name) !== -1) {
            return true;
        }
        const extra = catalog.extra || [];
        return extra.some(item => item && item.name === name);
    }

    catalogExtra(catalog, page, genre, search) {
        const extra = {};
        if (this.catalogSupports(catalog, "skip")) {
            extra.skip = String((this.safePage(page) - 1) * 100);
        }
        if (search && this.catalogSupports(catalog, "search")) {
            extra.search = this.cleanText(search);
        }
        if (this.catalogSupports(catalog, "genre")) {
            const selectedGenre = genre || this.requiredGenreFallback(catalog);
            if (selectedGenre) {
                extra.genre = selectedGenre;
            }
        }
        return extra;
    }

    requiredGenreFallback(catalog) {
        const years = catalog.genres || [];
        const currentYear = String(new Date().getFullYear());
        if (years.indexOf(currentYear) !== -1) {
            return currentYear;
        }
        return years.length > 0 && /^\d{4}$/.test(String(years[0])) ? String(years[0]) : "";
    }

    videoFromStream(stream, addonName, settings) {
        if (!stream || stream.infoHash || stream.fileIdx !== undefined || stream.magnet || stream.nzbUrl || stream.rarUrls || stream.zipUrls || stream.externalUrl) {
            return null;
        }
        const url = this.absoluteUrl(stream.url || "");
        if (!this.isPlayableDirectUrl(url, settings)) {
            return null;
        }

        const hints = stream.behaviorHints || {};
        const headers = hints.proxyHeaders && hints.proxyHeaders.request ? hints.proxyHeaders.request : undefined;
        const quality = this.streamQuality(stream, addonName, url);
        const video = {
            url,
            originalUrl: url,
            quality
        };
        if (headers) {
            video.headers = headers;
        }
        return video;
    }

    isPlayableDirectUrl(url, settings) {
        if (!url || this.isLocalUrl(url)) {
            return false;
        }
        const lower = String(url).toLowerCase();
        if (lower.indexOf("magnet:") === 0 || lower.indexOf("torrent") !== -1 && lower.indexOf(".torrent") !== -1) {
            return false;
        }
        if (lower.indexOf("https://") !== 0) {
            if (lower.indexOf("http://") !== 0 || !settings.allowHttpStreams) {
                return false;
            }
        }
        if (!settings.strictIosStreams) {
            return true;
        }
        return lower.indexOf(".m3u8") !== -1 ||
            lower.indexOf(".mp4") !== -1 ||
            lower.indexOf(".m4v") !== -1 ||
            lower.indexOf(".mov") !== -1 ||
            lower.indexOf("/hls") !== -1 ||
            lower.indexOf("playlist") !== -1 ||
            lower.indexOf("master") !== -1 ||
            lower.indexOf("manifest") !== -1;
    }

    streamQuality(stream, addonName, url) {
        const parts = [];
        const inferred = this.inferQuality(`${stream.name || ""} ${stream.title || ""} ${stream.description || ""} ${url}`);
        if (inferred) {
            parts.push(inferred);
        }
        if (stream.name) {
            parts.push(this.cleanText(stream.name));
        }
        if (stream.title || stream.description) {
            parts.push(this.cleanText(stream.title || stream.description));
        }
        if (addonName) {
            parts.push(`[${this.cleanText(addonName)}]`);
        }
        return parts.join(" - ").replace(/\s+/g, " ").trim() || "Direct stream";
    }

    inferQuality(value) {
        const text = String(value || "").toLowerCase();
        if (text.indexOf("2160") !== -1 || text.indexOf("4k") !== -1 || text.indexOf("uhd") !== -1) {
            return "4K";
        }
        if (text.indexOf("1080") !== -1) {
            return "1080p";
        }
        if (text.indexOf("720") !== -1) {
            return "720p";
        }
        if (text.indexOf("480") !== -1) {
            return "480p";
        }
        if (text.indexOf("360") !== -1) {
            return "360p";
        }
        if (text.indexOf(".m3u8") !== -1 || text.indexOf("/hls") !== -1) {
            return "HLS";
        }
        if (text.indexOf(".mp4") !== -1) {
            return "MP4";
        }
        return "";
    }

    sortVideos(videos) {
        const rank = value => {
            const text = String(value.quality || "").toLowerCase();
            if (text.indexOf("4k") !== -1 || text.indexOf("2160") !== -1) return 5;
            if (text.indexOf("1080") !== -1) return 4;
            if (text.indexOf("720") !== -1) return 3;
            if (text.indexOf("480") !== -1) return 2;
            if (text.indexOf("360") !== -1) return 1;
            return 0;
        };
        return videos.sort((a, b) => rank(b) - rank(a));
    }

    manifestHasResource(manifest, resourceName) {
        const resources = manifest && Array.isArray(manifest.resources) ? manifest.resources : [];
        return resources.some(resource => {
            if (typeof resource === "string") {
                return resource === resourceName;
            }
            return resource && resource.name === resourceName;
        });
    }

    streamManifestUrls(settings) {
        const urls = this.splitUrls(settings.streamManifestUrls)
            .map(url => this.manifestUrl(url))
            .filter(url => url && !this.isLocalUrl(url));
        return this.unique(urls);
    }

    videoProviderUrls(ref, settings) {
        const urls = [];
        const catalogManifest = this.manifestUrl(ref.metaBase || settings.catalogBaseUrl);
        if (catalogManifest) {
            urls.push(catalogManifest);
        }
        this.streamManifestUrls(settings).forEach(url => urls.push(url));
        return this.unique(urls);
    }

    splitUrls(value) {
        return String(value || "")
            .split(/[\n,;]+/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    resourceUrl(baseUrl, resource, type, id, extra) {
        const base = String(baseUrl || "").replace(/\/+$/, "");
        let url = `${base}/${resource}/${this.encodePathSegment(type)}/${this.encodePathSegment(id)}`;
        const extraPath = this.extraPath(extra);
        if (extraPath) {
            url += `/${extraPath}`;
        }
        return `${url}.json`;
    }

    extraPath(extra) {
        if (!extra) {
            return "";
        }
        const parts = [];
        Object.keys(extra).forEach(key => {
            const value = extra[key];
            if (value !== undefined && value !== null && String(value).length > 0) {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
            }
        });
        return parts.join("&");
    }

    encodePathSegment(value) {
        return encodeURIComponent(String(value || ""))
            .replace(/%3A/g, ":")
            .replace(/%2C/g, ",");
    }

    manifestUrl(value) {
        const base = this.manifestBaseUrl(value);
        return base ? `${base}/manifest.json` : "";
    }

    manifestBaseUrl(value) {
        let url = String(value || "").trim();
        if (!url) {
            return "";
        }
        url = url.replace(/^stremio:\/\//i, "https://");
        url = url.replace(/\/+$/, "");
        url = url.replace(/\/manifest\.json$/i, "");
        url = url.replace(/\/manifest$/i, "");
        if (url.indexOf("http://") !== 0 && url.indexOf("https://") !== 0) {
            url = `https://${url}`;
        }
        return url;
    }

    absoluteUrl(value) {
        const url = String(value || "").trim();
        if (!url) {
            return "";
        }
        if (url.indexOf("//") === 0) {
            return `https:${url}`;
        }
        return url;
    }

    isLocalUrl(value) {
        const lower = String(value || "").toLowerCase();
        const match = lower.match(/^[a-z]+:\/\/\[?([^\]\/:]+)/);
        const host = match ? match[1] : lower;
        return host === "localhost" ||
            host === "::1" ||
            host === "0.0.0.0" ||
            host === "127.0.0.1" ||
            /^127\./.test(host) ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
            /\.local$/.test(host);
    }

    packRef(ref) {
        return `stremio-bridge|${encodeURIComponent(JSON.stringify(ref || {}))}`;
    }

    unpackRef(value) {
        const text = String(value || "");
        if (text.indexOf("stremio-bridge|") !== 0) {
            return {};
        }
        try {
            return JSON.parse(decodeURIComponent(text.substring("stremio-bridge|".length)));
        } catch (error) {
            return {};
        }
    }

    readSettings() {
        const preferences = new SharedPreferences();
        const catalogManifestUrl = this.preference(preferences, "stremio_catalog_manifest_url", "https://v3-cinemeta.strem.io/manifest.json");
        const streamManifestUrls = this.preference(preferences, "stremio_stream_manifest_urls", "");
        const mediaType = this.preference(preferences, "stremio_catalog_type", "movie");
        const popularCatalogId = this.preference(preferences, "stremio_popular_catalog_id", "top");
        const catalogGenre = this.preference(preferences, "stremio_catalog_genre", "");
        const maxStreams = this.preference(preferences, "stremio_max_streams", "20");

        return {
            catalogManifestUrl: this.manifestUrl(catalogManifestUrl),
            catalogBaseUrl: this.manifestBaseUrl(catalogManifestUrl),
            streamManifestUrls,
            mediaType: mediaType === "series" ? "series" : "movie",
            popularCatalogId: popularCatalogId || "top",
            catalogGenre,
            maxStreams,
            strictIosStreams: this.boolPreference(preferences, "stremio_strict_ios_streams", true),
            allowHttpStreams: this.boolPreference(preferences, "stremio_allow_http_streams", false)
        };
    }

    preference(preferences, key, fallback) {
        const value = preferences.get(key);
        if (value === undefined || value === null || String(value).length === 0) {
            return fallback;
        }
        return value;
    }

    boolPreference(preferences, key, fallback) {
        const value = preferences.get(key);
        if (value === undefined || value === null || value === "") {
            return fallback;
        }
        return value === true || value === "true";
    }

    readFilters(filters, settings) {
        const selected = {
            mediaType: settings.mediaType,
            catalogId: settings.popularCatalogId,
            genre: settings.catalogGenre
        };

        if (!filters || !Array.isArray(filters)) {
            return selected;
        }

        filters.forEach(filter => {
            if (filter.type === "MediaTypeFilter") {
                selected.mediaType = this.selectFilterValue(filter) || selected.mediaType;
            } else if (filter.type === "CatalogFilter") {
                selected.catalogId = this.selectFilterValue(filter) || selected.catalogId;
            } else if (filter.type === "GenreFilter") {
                selected.genre = this.selectFilterValue(filter);
            }
        });

        return selected;
    }

    selectFilterValue(filter) {
        if (!filter.values || filter.state === undefined || filter.state === null) {
            return "";
        }
        const option = filter.values[Number(filter.state)];
        return option && option.value ? String(option.value) : "";
    }

    bestPoster(meta, size) {
        const poster = meta.poster || meta.image || meta.background || meta.logo || "";
        return this.upgradeMetaHubImage(this.normalizeImageUrl(poster), size);
    }

    upgradeMetaHubImage(url, size) {
        if (!url) {
            return "";
        }
        const target = size === "large" ? "large" : "medium";
        return url
            .replace(/\/poster\/small\//i, `/poster/${target}/`)
            .replace(/\/poster\/medium\//i, `/poster/${target}/`)
            .replace(/\/background\/small\//i, `/background/${target}/`)
            .replace(/\/background\/medium\//i, `/background/${target}/`);
    }

    normalizeImageUrl(url) {
        if (!url || typeof url !== "string") {
            return "";
        }
        try {
            return encodeURI(url)
                .replace(/\(/g, "%28")
                .replace(/\)/g, "%29")
                .replace(/'/g, "%27");
        } catch (error) {
            return url;
        }
    }

    detailDescription(meta) {
        const parts = [];
        if (meta.description) {
            parts.push(this.cleanText(meta.description));
        }
        if (meta.releaseInfo || meta.year) {
            parts.push(`Release: ${this.cleanText(meta.releaseInfo || meta.year)}`);
        }
        if (meta.runtime) {
            parts.push(`Runtime: ${this.cleanText(meta.runtime)}`);
        }
        if (meta.imdbRating) {
            parts.push(`IMDb: ${this.cleanText(meta.imdbRating)}`);
        }
        return parts.join("\n\n");
    }

    statusFromMeta(meta) {
        const status = this.cleanText(meta.status).toLowerCase();
        if (meta.type === "movie") {
            return 1;
        }
        if (status.indexOf("ended") !== -1 || status.indexOf("completed") !== -1) {
            return 1;
        }
        if (status.indexOf("continuing") !== -1 || status.indexOf("returning") !== -1) {
            return 0;
        }
        return 5;
    }

    toDateUpload(value) {
        if (!value) {
            return null;
        }
        const millis = new Date(value).valueOf();
        return Number.isNaN(millis) ? null : millis.toString();
    }

    joinNames(value) {
        if (Array.isArray(value)) {
            return value.map(item => this.cleanText(item)).filter(Boolean).join(", ");
        }
        return this.cleanText(value);
    }

    safePage(page) {
        const value = Number(page || 1);
        return value > 0 ? value : 1;
    }

    unique(values) {
        const seen = {};
        return values.filter(value => {
            if (!value || seen[value]) {
                return false;
            }
            seen[value] = true;
            return true;
        });
    }

    hostLabel(url) {
        const match = String(url || "").match(/^https?:\/\/([^/]+)/i);
        return match ? match[1] : "Stremio";
    }

    cleanText(value) {
        if (value === null || value === undefined) {
            return "";
        }
        return String(value)
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, "\"")
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/\s+/g, " ")
            .trim();
    }

    genreOptions() {
        const currentYear = String(new Date().getFullYear());
        return [
            ["All", ""],
            ["Action", "Action"],
            ["Adventure", "Adventure"],
            ["Animation", "Animation"],
            ["Biography", "Biography"],
            ["Comedy", "Comedy"],
            ["Crime", "Crime"],
            ["Documentary", "Documentary"],
            ["Drama", "Drama"],
            ["Family", "Family"],
            ["Fantasy", "Fantasy"],
            ["History", "History"],
            ["Horror", "Horror"],
            ["Mystery", "Mystery"],
            ["Romance", "Romance"],
            ["Sci-Fi", "Sci-Fi"],
            ["Sport", "Sport"],
            ["Thriller", "Thriller"],
            ["War", "War"],
            ["Western", "Western"],
            ["Reality-TV", "Reality-TV"],
            ["Talk-Show", "Talk-Show"],
            ["Game-Show", "Game-Show"],
            [currentYear, currentYear],
            [String(Number(currentYear) - 1), String(Number(currentYear) - 1)],
            [String(Number(currentYear) - 2), String(Number(currentYear) - 2)]
        ];
    }
}
