/** Interface language is chosen once per build by siteConfig.locale. */
import { siteConfig } from "#src/config.ts";
import {
    dictionaries,
    languageTags,
    translate,
    type Locale,
    type UIKey,
    type TranslationValues,
} from "#src/locales/index.ts";

export type { UIKey } from "#src/locales/index.ts";

export const LOCALE: Locale = siteConfig.locale;
export const ui = dictionaries[LOCALE];
export const HTML_LANG = languageTags[LOCALE];
export const t = (key: UIKey, values?: TranslationValues): string => translate(LOCALE, key, values);
