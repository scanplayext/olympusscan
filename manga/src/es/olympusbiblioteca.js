const mangayomiSources = [
    {
        "name": "Olympus Biblioteca",
        "id": 443280917,
        "baseUrl": "https://olympusbiblioteca.com",
        "apiUrl": "https://dashboard.olympusbiblioteca.com/api",
        "lang": "es",
        "typeSource": "single",
        "iconUrl": "https://olympusbiblioteca.com/olympus-logo-96.webp",
        "itemType": 0,
        "isNsfw": false,
        "version": "0.1.0",
        "dateFormat": "",
        "dateFormatLocale": "es_es",
        "pkgPath": "manga/src/es/olympusbiblioteca.js",
        "pkgName": "manga/src/es/olympusbiblioteca.js"
    }
];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.seriesListCache = null;
        this.seriesListCacheTime = 0;
        this.seriesListTtlMs = 1000 * 60 * 20;
        this.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    }

    getHeaders(url) {
        if (url && url.indexOf("dashboard.olympusbiblioteca.com/storage/") !== -1) {
            return this.imageHeaders();
        }
        return {
            "User-Agent": this.userAgent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": `${this.source.baseUrl}/`,
            "Origin": this.source.baseUrl
        };
    }

    imageHeaders() {
        return {
            "User-Agent": this.userAgent,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": `${this.source.baseUrl}/`
        };
    }

    async getPopular(page) {
        try {
            const url = `${this.source.baseUrl}/api/rankings?page=${this.safePage(page)}&period=monthly_ranking`;
            return this.seriesPageResult(await this.requestJson(url));
        } catch (error) {
            return this.emptyPage();
        }
    }

    async getLatestUpdates(page) {
        try {
            const url = `${this.source.baseUrl}/api/new-chapters?page=${this.safePage(page)}`;
            return this.seriesPageResult(await this.requestJson(url));
        } catch (error) {
            return this.emptyPage();
        }
    }

    async search(query, page, filters) {
        try {
            const selected = this.readFilters(filters);
            const text = this.normalize(query);
            const currentPage = this.safePage(page);

            if (text.length > 0) {
                const allSeries = await this.searchCandidates(selected);
                const filtered = allSeries.filter(item => {
                    const haystack = this.normalize(`${item.name || ""} ${item.slug || ""}`);
                    return haystack.indexOf(text) !== -1;
                });
                return this.arrayPageResult(filtered, currentPage, 20);
            }

            const params = [
                `type=comic`,
                `page=${currentPage}`,
                `direction=${selected.direction}`
            ];

            if (selected.genre) {
                params.push(`genres=${encodeURIComponent(selected.genre)}`);
            }
            if (selected.status) {
                params.push(`status=${encodeURIComponent(selected.status)}`);
            }

            const url = `${this.source.baseUrl}/api/series?${params.join("&")}`;
            return this.seriesPageResult(this.unwrapSeriesPage(await this.requestJson(url)));
        } catch (error) {
            return this.emptyPage();
        }
    }

    async getDetail(url) {
        const info = this.seriesInfoFromUrl(url);
        let slug = info.slug;
        let detail = null;

        try {
            detail = await this.fetchSeriesDetail(slug);
        } catch (error) {
            if (info.id) {
                const current = await this.findSeriesById(info.id);
                if (current && current.slug && current.slug !== slug) {
                    slug = current.slug;
                    detail = await this.fetchSeriesDetail(slug);
                }
            }
            if (!detail) {
                throw error;
            }
        }

        const manga = detail.data || detail;
        const chapters = await this.fetchChapters(slug, manga.chapter_count);
        const genres = (manga.genres || []).map(genre => this.cleanText(genre.name));

        return {
            name: this.cleanText(manga.name),
            imageUrl: this.bestImage(manga.cover, manga.cover_srcset),
            author: manga.team && manga.team.name ? this.cleanText(manga.team.name) : "Olympus",
            artist: "",
            description: this.cleanText(manga.summary),
            genre: genres,
            genres,
            status: this.statusFromOlympus(manga.status),
            chapters
        };
    }

    async getPageList(url) {
        const info = this.chapterInfoFromUrl(url);
        if (!info.slug || !info.id) {
            return [];
        }

        const apiUrl = `${this.source.baseUrl}/api/capitulo/${encodeURIComponent(info.slug)}/${encodeURIComponent(info.id)}?type=comic`;
        const json = await this.requestJson(apiUrl);
        const pages = json.chapter && json.chapter.pages ? json.chapter.pages : [];
        return pages
            .filter(pageUrl => typeof pageUrl === "string" && pageUrl.length > 0)
            .map(pageUrl => ({
                url: pageUrl,
                headers: this.imageHeaders()
            }));
    }

    getFilterList() {
        return [
            {
                type_name: "HeaderFilter",
                name: "Olympus Biblioteca: filtros directos de genero, estado y orden."
            },
            {
                type_name: "SelectFilter",
                type: "GenreFilter",
                name: "Genero",
                state: 0,
                values: this.genreOptions().map(item => ({
                    type_name: "SelectOption",
                    name: item[0],
                    value: item[1]
                }))
            },
            {
                type_name: "SelectFilter",
                type: "StatusFilter",
                name: "Estado",
                state: 0,
                values: this.statusOptions().map(item => ({
                    type_name: "SelectOption",
                    name: item[0],
                    value: item[1]
                }))
            },
            {
                type_name: "SortFilter",
                type: "SortFilter",
                name: "Orden",
                state: {
                    type_name: "SortState",
                    index: 0,
                    ascending: true
                },
                values: [
                    {
                        type_name: "SelectOption",
                        name: "Nombre",
                        value: "name"
                    }
                ]
            }
        ];
    }

    async fetchSeriesDetail(slug) {
        const url = `${this.source.baseUrl}/api/series/${encodeURIComponent(slug)}?type=comic`;
        return this.requestJson(url);
    }

    async fetchChapters(slug, chapterCount) {
        const chapters = [];
        let page = 1;
        let lastPage = 1;
        const expectedPages = chapterCount ? Math.ceil(Number(chapterCount) / 40) + 2 : 80;
        const maxPages = Math.max(1, Math.min(80, expectedPages));

        do {
            const url = `${this.source.apiUrl}/series/${encodeURIComponent(slug)}/chapters?type=comic&page=${page}&direction=desc`;
            const json = await this.requestJson(url);
            const pageChapters = json.data || [];

            pageChapters.forEach(chapter => {
                chapters.push({
                    name: `Capitulo ${this.cleanText(chapter.name)}`,
                    url: `/capitulo/${chapter.id}/comic-${slug}`,
                    scanlator: chapter.team && chapter.team.name ? this.cleanText(chapter.team.name) : "Olympus",
                    dateUpload: this.toDateUpload(chapter.published_at)
                });
            });

            lastPage = json.meta && json.meta.last_page ? Number(json.meta.last_page) : page;
            page += 1;
        } while (page <= lastPage && page <= maxPages);

        return chapters;
    }

    async searchCandidates(selected) {
        if (selected.genre || selected.status) {
            return this.fetchAllArchiveMatches(selected);
        }

        const list = await this.loadSeriesList();
        return list.filter(item => item.type === "comic");
    }

    async fetchAllArchiveMatches(selected) {
        const all = [];
        let page = 1;
        let lastPage = 1;

        do {
            const params = [
                "type=comic",
                `page=${page}`,
                `direction=${selected.direction}`
            ];
            if (selected.genre) {
                params.push(`genres=${encodeURIComponent(selected.genre)}`);
            }
            if (selected.status) {
                params.push(`status=${encodeURIComponent(selected.status)}`);
            }

            const json = this.unwrapSeriesPage(await this.requestJson(`${this.source.baseUrl}/api/series?${params.join("&")}`));
            (json.data || []).forEach(item => all.push(item));
            lastPage = json.last_page ? Number(json.last_page) : page;
            page += 1;
        } while (page <= lastPage && page <= 80);

        return all;
    }

    async loadSeriesList() {
        const now = Date.now();
        if (this.seriesListCache && now - this.seriesListCacheTime < this.seriesListTtlMs) {
            return this.seriesListCache;
        }

        const json = await this.requestJson(`${this.source.baseUrl}/api/series/list`);
        this.seriesListCache = json.data || [];
        this.seriesListCacheTime = now;
        return this.seriesListCache;
    }

    async findSeriesById(id) {
        const list = await this.loadSeriesList();
        return list.find(item => String(item.id) === String(id) && item.type === "comic");
    }

    async requestJson(url) {
        const response = await this.client.get(url, this.getHeaders(url));
        if (!response || !response.body) {
            throw new Error(`Empty Olympus response: ${url}`);
        }
        const json = JSON.parse(response.body);
        if (json && json.error) {
            throw new Error(json.message || `Olympus error: ${url}`);
        }
        return json;
    }

    seriesPageResult(json) {
        const page = this.unwrapSeriesPage(json);
        return {
            list: (page.data || [])
                .filter(item => item && item.type === "comic")
                .map(item => this.mangaFromSeries(item)),
            hasNextPage: this.hasNextPage(page)
        };
    }

    arrayPageResult(items, page, perPage) {
        const offset = (page - 1) * perPage;
        const slice = items.slice(offset, offset + perPage);
        return {
            list: slice.map(item => this.mangaFromSeries(item)),
            hasNextPage: offset + perPage < items.length
        };
    }

    emptyPage() {
        return {
            list: [],
            hasNextPage: false
        };
    }

    unwrapSeriesPage(json) {
        if (json && json.data && json.data.series) {
            return json.data.series;
        }
        return json || {};
    }

    mangaFromSeries(item) {
        const slug = item.slug || "";
        const id = item.id ? `#${item.id}` : "";
        return {
            name: this.cleanText(item.name),
            imageUrl: this.bestImage(item.cover, item.cover_srcset),
            link: `/series/comic-${slug}${id}`
        };
    }

    bestImage(cover, srcset) {
        if (srcset && typeof srcset === "string") {
            const urls = srcset
                .split(",")
                .map(value => value.trim().split(/\s+/)[0])
                .filter(value => value && value !== "768w" && value !== "1536w");
            if (urls.length > 0) {
                return urls[urls.length - 1];
            }
        }
        if (cover && typeof cover === "string" && cover.trim().length > 0) {
            return cover.trim();
        }
        return `${this.source.baseUrl}/olympus-logo-180.webp`;
    }

    seriesInfoFromUrl(url) {
        let value = String(url || "");
        const idMatch = value.match(/#(\d+)$/);
        const id = idMatch ? idMatch[1] : "";
        value = value.replace(/#\d+$/, "");
        value = value.split("?")[0];
        value = value.replace(this.source.baseUrl, "");
        value = value.replace(/^\/series\//, "");
        value = value.replace(/^comic-/, "");
        value = value.replace(/^novela-/, "");
        value = value.replace(/^\/+/, "");
        return {
            slug: decodeURIComponent(value),
            id
        };
    }

    chapterInfoFromUrl(url) {
        const value = String(url || "");
        const route = value.match(/\/capitulo\/(\d+)\/comic-([^?#]+)/);
        if (route) {
            return {
                id: route[1],
                slug: decodeURIComponent(route[2])
            };
        }

        const legacy = value.match(/^([^#|]+)[#|](\d+)$/);
        if (legacy) {
            return {
                slug: decodeURIComponent(legacy[1]),
                id: legacy[2]
            };
        }

        return {
            id: "",
            slug: ""
        };
    }

    readFilters(filters) {
        const selected = {
            genre: "",
            status: "",
            direction: "asc"
        };

        if (!filters || !Array.isArray(filters)) {
            return selected;
        }

        filters.forEach(filter => {
            if (filter.type === "GenreFilter") {
                selected.genre = this.selectFilterValue(filter);
            } else if (filter.type === "StatusFilter") {
                selected.status = this.selectFilterValue(filter);
            } else if (filter.type === "SortFilter" && filter.state) {
                selected.direction = filter.state.ascending ? "asc" : "desc";
            } else if (filter.type === "GenreCheckBoxFilter") {
                selected.genre = this.firstCheckedValue(filter);
            } else if (filter.type === "StatusCheckBoxFilter") {
                selected.status = this.firstCheckedValue(filter);
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

    firstCheckedValue(filter) {
        const checked = (filter.state || []).find(item => item.state && item.value);
        return checked ? String(checked.value) : "";
    }

    statusFromOlympus(status) {
        const id = status && status.id ? Number(status.id) : 0;
        const name = this.normalize(status && status.name ? status.name : "");

        if (id === 4 || name.indexOf("finalizado") !== -1) {
            return 1;
        }
        if (id === 3 || name.indexOf("hiatus") !== -1 || name.indexOf("pausado") !== -1) {
            return 2;
        }
        if (id === 5 || id === 7 || name.indexOf("cancelado") !== -1 || name.indexOf("abandonado") !== -1) {
            return 3;
        }
        if (id === 1 || name.indexOf("activo") !== -1) {
            return 0;
        }
        return 5;
    }

    toDateUpload(value) {
        if (!value) {
            return null;
        }
        const normalized = String(value).replace(" ", "T");
        const millis = new Date(normalized).valueOf();
        return Number.isNaN(millis) ? null : millis.toString();
    }

    hasNextPage(page) {
        if (page.next_page_url) {
            return true;
        }
        if (page.links && page.links.next) {
            return true;
        }
        if (page.current_page && page.last_page) {
            return Number(page.current_page) < Number(page.last_page);
        }
        if (page.meta && page.meta.current_page && page.meta.last_page) {
            return Number(page.meta.current_page) < Number(page.meta.last_page);
        }
        return false;
    }

    safePage(page) {
        const value = Number(page || 1);
        return value > 0 ? value : 1;
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
            .replace(/\s+/g, " ")
            .trim();
    }

    normalize(value) {
        const text = this.cleanText(value).toLowerCase();
        try {
            return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        } catch (error) {
            return text;
        }
    }

    genreOptions() {
        return [
            ["Todos", ""],
            ["Accion", "1"],
            ["Stream", "72"],
            ["Apocaliptico", "3"],
            ["Artes marciales", "4"],
            ["Aventura", "5"],
            ["Ciencia Ficcion", "6"],
            ["Comedia", "7"],
            ["Crimen", "8"],
            ["Cultivacion", "9"],
            ["Deportes", "10"],
            ["Arquero", "73"],
            ["Ecchi", "12"],
            ["Familia", "13"],
            ["Fantasia", "14"],
            ["Guerra", "15"],
            ["Harem", "16"],
            ["Historico", "17"],
            ["Juego", "18"],
            ["Magia", "19"],
            ["Misterio", "20"],
            ["Murim", "21"],
            ["Psicologico", "22"],
            ["Realidad virtual", "23"],
            ["Recuentos de la vida", "24"],
            ["Reencarnacion", "25"],
            ["Romance", "26"],
            ["Seinen", "27"],
            ["Shonen", "28"],
            ["Shoujo", "29"],
            ["Sistema", "30"],
            ["Sobrenatural", "31"],
            ["Spokon", "32"],
            ["Superpoderes", "33"],
            ["Supervivencia", "34"],
            ["Suspenso", "35"],
            ["Terror", "36"],
            ["Tragedia", "37"],
            ["Vida Escolar", "38"],
            ["+15", "39"],
            ["Retornado", "40"],
            ["Medico", "41"],
            ["Isekai", "42"],
            ["Drama", "43"],
            ["Demonios", "44"],
            ["Criptomonedas", "47"],
            ["Venganza", "48"],
            ["Mafia", "49"],
            ["Analisis", "50"],
            ["Constelaciones", "51"],
            ["Pantallas de sistemas", "52"],
            ["Escritor", "53"],
            ["Meian", "54"],
            ["Horror", "55"],
            ["Supernatural", "56"],
            ["Girls Love", "57"],
            ["Posible Harem", "58"],
            ["Monstruos", "59"],
            ["Bestias", "60"],
            ["Evolucion", "61"],
            ["Zombis", "62"],
            ["IA", "63"],
            ["WAIFU", "64"],
            ["Viajero", "65"],
            ["Prota mamado", "66"],
            ["Nigromante", "67"],
            ["Anti-heroe", "68"],
            ["Villano", "69"],
            ["Superpoderes", "70"],
            ["Transmigracion", "71"]
        ];
    }

    statusOptions() {
        return [
            ["Todos", ""],
            ["Activo", "1"],
            ["Finalizado", "4"],
            ["Cancelado por el autor", "5"],
            ["Pausado por el autor (Hiatus)", "3"],
            ["Abandonado por el scan", "7"]
        ];
    }
}
