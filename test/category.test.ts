import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import {
    categoryContains,
    categoryFromFile,
    categoryLabel,
    categoryPath,
    countCategories,
    flattenCategories,
} from "../src/posts/category.ts";
import { dictionaries } from "../src/locales/index.ts";

const root = "src/content/posts";
const from = (path: string) => categoryFromFile(`${root}/${path}`, root);

void test("all directory levels form an untranslated category path", () => {
    const category = from("Statistics/Probability/Continuous/normal.mdx");
    assert.deepEqual(category, {
        key: "statistics/probability/continuous",
        name: "Continuous",
        trail: [
            { key: "statistics", name: "Statistics" },
            { key: "statistics/probability", name: "Probability" },
            { key: "statistics/probability/continuous", name: "Continuous" },
        ],
    });
    assert.equal(categoryLabel(category), "Statistics / Probability / Continuous");
    assert.equal(categoryPath(category.key), "/categories/statistics/probability/continuous/");
    assert.deepEqual(
        categoryFromFile(resolve(root, "Statistics/intro.mdx"), root),
        from("Statistics/intro.mdx"),
    );
    const korean = from("Statistics/확률과 통계/R&D/intro.md");
    assert.equal(categoryLabel(korean), "Statistics / 확률과 통계 / R&D");
    assert.equal(
        categoryPath(korean.key),
        `/categories/statistics/${encodeURIComponent("확률과-통계")}/rd/`,
    );
    assert.equal(
        categoryFromFile("src/fixtures/posts/New Topic/intro.md", "src/fixtures/posts").name,
        "New Topic",
    );
    assert.throws(() => from("Statistics/+++/intro.md"), /nonempty URL slug/u);
    assert.throws(() => from("intro.md"), /category folder/u);
    assert.throws(() => categoryFromFile("src/content/pages/about.md", root), /category folder/u);
});

void test("parent counts include direct posts and descendants without merging equal leaf names", () => {
    const categories = [
        "Statistics/overview.md",
        "Statistics/Probability/discrete.md",
        "Statistics/Probability/Continuous/normal.md",
        "Statistics/Regression/linear.md",
        "Engineering/Probability/retries.md",
        "Statistics-Extra/intro.md",
    ].map(from);
    const tree = countCategories(categories);
    assert.deepEqual(
        tree.map(({ name }) => name),
        ["Engineering", "Statistics", "Statistics-Extra"],
    );
    assert.deepEqual(
        flattenCategories(tree).map(({ key, count }) => [key, count]),
        [
            ["engineering", 1],
            ["engineering/probability", 1],
            ["statistics", 4],
            ["statistics/probability", 2],
            ["statistics/probability/continuous", 1],
            ["statistics/regression", 1],
            ["statistics-extra", 1],
        ],
    );
    assert.deepEqual(
        categories
            .filter(({ key }) => categoryContains("statistics/probability", key))
            .map(({ name }) => name),
        ["Probability", "Continuous"],
    );
    assert.equal(categoryContains("statistics", "statistics-extra"), false);
    assert.equal(categoryContains("statistics/probability", "engineering/probability"), false);
    assert.deepEqual(countCategories([]), []);
});

void test("ambiguous names fail at every level and category names never enter locale catalogs", () => {
    assert.throws(
        () => countCategories([from("Statistics/A/intro.md"), from("statistics/B/intro.md")]),
        /share the URL/u,
    );
    assert.throws(
        () => countCategories([from("Statistics/R&D/a.md"), from("Statistics/RD/b.md")]),
        /share the URL/u,
    );
    for (const messages of Object.values(dictionaries)) {
        assert.equal(
            Object.keys(messages).some((key) => key.startsWith("category.")),
            false,
        );
    }
});
