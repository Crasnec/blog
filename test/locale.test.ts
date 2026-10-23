import assert from "node:assert/strict";
import { test } from "node:test";
import {
    dictionaries,
    languageTags,
    translate,
    type Locale,
    type UIKey,
} from "#src/locales/index.ts";
import {
    countLabel,
    longDate,
    machineDate,
    readingTimeLabel,
    shortDate,
    shortStampDate,
    stampDate,
    yearLabel,
} from "#src/utils/format.ts";

void test("both locales supply the same messages and interpolation placeholders", () => {
    assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.ko).sort());
    for (const key of Object.keys(dictionaries.en) as UIKey[]) {
        const placeholders = (value: string) =>
            [...value.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
        assert.deepEqual(
            placeholders(dictionaries.en[key]),
            placeholders(dictionaries.ko[key]),
            key,
        );
    }
    assert.equal(translate("en", "playground.run"), "Run");
    assert.equal(translate("ko", "playground.run"), "실행");
    assert.equal(
        translate("ko", "playground.packagesLoading", { packages: "NumPy" }),
        "NumPy 불러오는 중…",
    );
    assert.throws(() => translate("ko", "post.updated"), /Missing "date"/u);
});

void test("counts, reading times and updated dates follow each language's grammar", () => {
    assert.equal(countLabel(0, "en"), "0 posts");
    assert.equal(countLabel(1, "en"), "1 post");
    assert.equal(countLabel(2, "en"), "2 posts");
    assert.equal(countLabel(1000, "en"), "1,000 posts");
    assert.equal(countLabel(0, "ko"), "0개의 글");
    assert.equal(countLabel(1, "ko"), "1개의 글");
    assert.equal(countLabel(1000, "ko"), "1,000개의 글");
    assert.equal(readingTimeLabel(3, "en"), "3 min");
    assert.equal(readingTimeLabel(3, "ko"), "3분");
    assert.equal(translate("en", "post.updated", { date: "October 21" }), "Updated October 21");
    assert.equal(translate("ko", "post.updated", { date: "10월 21일" }), "10월 21일 수정");
});

void test("display dates localize while machine dates retain the same UTC calendar day", () => {
    const date = new Date("2026-10-21T00:00:00Z");
    assert.equal(longDate(date, "en"), "October 21, 2026");
    assert.equal(longDate(date, "ko"), "2026년 10월 21일");
    assert.equal(shortDate(date, "en"), "October 21");
    assert.equal(shortDate(date, "ko"), "10월 21일");
    assert.equal(stampDate(date, "en"), "2026 · 10 · 21");
    assert.equal(stampDate(date, "ko"), "2026. 10. 21.");
    assert.equal(shortStampDate(date, "en"), "10 · 21");
    assert.equal(shortStampDate(date, "ko"), "10. 21.");
    assert.equal(yearLabel(2026, "en"), "2026");
    assert.equal(yearLabel(2026, "ko"), "2026년");
    for (const locale of Object.keys(languageTags) as Locale[]) {
        const midnightOffset = new Date("2026-10-21T00:30:00+09:00");
        assert.equal(machineDate(midnightOffset), "2026-10-20");
        assert.equal(
            stampDate(midnightOffset, locale),
            locale === "en" ? "2026 · 10 · 20" : "2026. 10. 20.",
        );
        const leapDay = new Date("2024-02-29T23:59:59Z");
        assert.equal(machineDate(leapDay), "2024-02-29");
        assert.ok(shortDate(leapDay, locale).includes("29"));
    }
});
