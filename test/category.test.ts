import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { categoryFromFile, countCategories } from "../src/utils/category.ts";
import { dictionaries } from "../src/locales/index.ts";

const root = "src/content/posts";

void test("the first folder classifies posts and preserves the author's spelling", () => {
	assert.deepEqual(categoryFromFile(`${root}/Statistics/intro.mdx`, root), { key: "statistics", name: "Statistics" });
	assert.deepEqual(categoryFromFile(resolve(root, "Statistics/nested/intro.mdx"), root), { key: "statistics", name: "Statistics" });
	assert.deepEqual(categoryFromFile(`${root}/확률과 통계/intro.md`, root), { key: "확률과-통계", name: "확률과 통계" });
	assert.deepEqual(categoryFromFile("src/fixtures/posts/New Topic/intro.md", "src/fixtures/posts"), { key: "new-topic", name: "New Topic" });
	assert.deepEqual(categoryFromFile(`${root}/R&D/intro.md`, root), { key: "rd", name: "R&D" });
	assert.throws(() => categoryFromFile(`${root}/+++/intro.md`, root), /nonempty URL slug/u);
	assert.throws(() => categoryFromFile(`${root}/intro.md`, root), /category folder/u);
	assert.throws(() => categoryFromFile("src/content/pages/about.md", root), /category folder/u);
});

void test("moving a post changes its category without registration or translation", () => {
	const names = ["Statistics", "Backend", "Statistics"];
	const categories = names.map((name) => categoryFromFile(`${root}/${name}/intro.md`, root));
	assert.deepEqual(countCategories(categories), [
		{ key: "backend", name: "Backend", count: 1 },
		{ key: "statistics", name: "Statistics", count: 2 },
	]);
	assert.deepEqual(countCategories([]), []);
	for (const messages of Object.values(dictionaries)) {
		assert.equal(Object.keys(messages).some((key) => key.startsWith("category.")), false);
	}
	assert.throws(() => countCategories([
		categoryFromFile(`${root}/Statistics/a.md`, root),
		categoryFromFile(`${root}/statistics/b.md`, root),
	]), /share the URL/u);
});
