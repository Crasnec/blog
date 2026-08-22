/**
 * Dates and counts, as they are printed.
 */
import { HTML_LANG, ui } from "../strings";

/**
 * A count with its counter — "3 posts", and "1 post" rather than "1 posts".
 *
 * Several views were spelling this out with the same inline ternary, which is
 * several places to forget the singular.
 */
export function countLabel(n: number): string {
	return `${String(n)} ${ui[n === 1 ? "index.countOne" : "index.count"]}`;
}

/**
 * The numeric date stamp used in the margin and on index entries.
 *
 * A filing mark rather than prose, which is why it is digits and not a month
 * name: the entries line up on a grid and a stamp that changed width would
 * break the column.
 */
export function stampDate(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	return `${String(y)} · ${m} · ${d}`;
}

/**
 * Long-form date, for the top of an article.
 *
 * `stampDate` exists so dates line up in a column on the index; at the head of
 * a post nothing is lining up, and "2026 · 08 · 04" there is just digits. This
 * is the one a person reads.
 */
export function longDate(date: Date): string {
	return new Intl.DateTimeFormat(HTML_LANG, {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	}).format(date);
}

/** The same without the year, for a second date already sitting beside a first. */
export function shortDate(date: Date): string {
	return new Intl.DateTimeFormat(HTML_LANG, {
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	}).format(date);
}

/** `2026-08-12`, for `<time datetime>`. */
export function machineDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
