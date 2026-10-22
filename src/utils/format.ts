/**
 * Dates and counts, as they are printed.
 */
import { LOCALE } from "../strings.ts";
import { languageTags, translate, type Locale } from "../locales/index.ts";

/**
 * A count with its counter — "3 posts", and "1 post" rather than "1 posts".
 *
 * Several views were spelling this out with the same inline ternary, which is
 * several places to forget the singular.
 */
export function countLabel(n: number, locale: Locale = LOCALE): string {
    return translate(locale, n === 1 ? "index.countOne" : "index.count", {
        count: n.toLocaleString(languageTags[locale]),
    });
}

export function readingTimeLabel(minutes: number, locale: Locale = LOCALE): string {
    return translate(locale, "post.readingTime", {
        count: minutes.toLocaleString(languageTags[locale]),
    });
}

export function yearLabel(year: number, locale: Locale = LOCALE): string {
    return translate(locale, "date.year", { year });
}

/**
 * The numeric date stamp used in the margin and on index entries.
 *
 * A filing mark rather than prose, which is why it is digits and not a month
 * name: the entries line up on a grid and a stamp that changed width would
 * break the column.
 */
export function stampDate(date: Date, locale: Locale = LOCALE): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return translate(locale, "date.stamp", { year: y, month: m, day: d });
}

/** Numeric month and day for an archive grouped by year. */
export function shortStampDate(date: Date, locale: Locale = LOCALE): string {
    return translate(locale, "date.shortStamp", {
        month: String(date.getUTCMonth() + 1).padStart(2, "0"),
        day: String(date.getUTCDate()).padStart(2, "0"),
    });
}

/**
 * Long-form date, for the top of an article.
 *
 * `stampDate` exists so dates line up in a column on the index; at the head of
 * a post nothing is lining up, and "2026 · 08 · 04" there is just digits. This
 * is the one a person reads.
 */
export function longDate(date: Date, locale: Locale = LOCALE): string {
    return new Intl.DateTimeFormat(languageTags[locale], {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    }).format(date);
}

/** The same without the year, for a second date already sitting beside a first. */
export function shortDate(date: Date, locale: Locale = LOCALE): string {
    return new Intl.DateTimeFormat(languageTags[locale], {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    }).format(date);
}

/** `2026-08-12`, for `<time datetime>`. */
export function machineDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}
