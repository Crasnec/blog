interface PagefindResult {
    url: string;
    meta?: { title?: string };
    excerpt?: string;
}

interface Pagefind {
    options?: (options: { excerptLength: number }) => Promise<void>;
    search: (q: string) => Promise<object | null | undefined>;
}

interface PagefindReference {
    data: () => Promise<object | null | undefined>;
}

function isPagefindReference(value: object): value is PagefindReference {
    return "data" in value && typeof value.data === "function";
}

export function readPagefindReferences(value: object | null | undefined): PagefindReference[] {
    if (typeof value !== "object" || value === null || !("results" in value)) {
        throw new TypeError("Invalid Pagefind search response");
    }
    if (!Array.isArray(value.results)) {
        throw new TypeError("Invalid Pagefind result list");
    }
    return value.results.map((entry: object | null | undefined) => {
        if (typeof entry !== "object" || entry === null || !isPagefindReference(entry)) {
            throw new TypeError("Invalid Pagefind result reference");
        }
        return entry;
    });
}

export function readPagefindResult(value: object | null | undefined): PagefindResult {
    if (
        typeof value !== "object" ||
        value === null ||
        !("url" in value) ||
        typeof value.url !== "string" ||
        !value.url.trim()
    ) {
        throw new TypeError("Invalid Pagefind result URL");
    }
    const url = new URL(value.url, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new TypeError("Invalid Pagefind result URL protocol");
    }
    const result: PagefindResult = { url: value.url };
    if ("meta" in value && value.meta !== undefined) {
        const meta = value.meta;
        if (typeof meta !== "object" || meta === null) {
            throw new TypeError("Invalid Pagefind result metadata");
        }
        if ("title" in meta && meta.title !== undefined) {
            if (typeof meta.title !== "string") {
                throw new TypeError("Invalid Pagefind result title");
            }
            result.meta = { title: meta.title };
        }
    }
    if ("excerpt" in value && value.excerpt !== undefined) {
        if (typeof value.excerpt !== "string") {
            throw new TypeError("Invalid Pagefind result excerpt");
        }
        result.excerpt = value.excerpt;
    }
    return result;
}

function isPagefind(value: object): value is Pagefind {
    return (
        "search" in value &&
        typeof value.search === "function" &&
        (!("options" in value) ||
            value.options === undefined ||
            typeof value.options === "function")
    );
}

let pagefind: Pagefind | null = null;
let pagefindLoading: Promise<Pagefind | null> | null = null;

export async function loadPagefind(): Promise<Pagefind | null> {
    if (pagefind) {
        return pagefind;
    }
    if (pagefindLoading) {
        return pagefindLoading;
    }
    pagefindLoading = (async () => {
        try {
            const url = `${import.meta.env.BASE_URL}pagefind/pagefind.js`.replace("//", "/");
            // An ECMAScript module namespace is always an object. Its callable surface
            // is still checked below before it reaches application code.
            const loaded = (await import(/* @vite-ignore */ url)) as object;
            if (!isPagefind(loaded)) {
                throw new TypeError("Invalid Pagefind module");
            }
            await loaded.options?.({ excerptLength: 24 });
            pagefind = loaded;
            return pagefind;
        } catch {
            // The index only exists after `astro build`; in dev this is expected.
            return null;
        } finally {
            pagefindLoading = null;
        }
    })();
    return pagefindLoading;
}
