import { en, type UIKey } from "./en.ts";
import { ko } from "./ko.ts";

export type { Messages, UIKey } from "./en.ts";

export const dictionaries = { en, ko } as const;
export type Locale = keyof typeof dictionaries;
export const languageTags = { en: "en-US", ko: "ko-KR" } as const satisfies Record<Locale, string>;
export type TranslationValues = Readonly<Record<string, string | number>>;

/** A missing value is a programming error rather than visible placeholder text. */
export function translate(locale: Locale, key: UIKey, values: TranslationValues = {}): string {
	return dictionaries[locale][key].replace(/\{(\w+)\}/gu, (placeholder, name: string) => {
		const value = values[name];
		if (value === undefined) throw new Error(`Missing "${name}" for ${locale}:${key} (${placeholder})`);
		return String(value);
	});
}
