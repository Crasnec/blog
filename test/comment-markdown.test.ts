import assert from "node:assert/strict";
import { test } from "node:test";

import { renderCommentBody } from "../src/utils/comment-markdown.ts";

void test("comment Markdown keeps a deliberately small, safe HTML subset", () => {
	const html = renderCommentBody(`
# Comment heading

<script>alert("no")</script>

![tracking pixel](https://tracker.example/pixel.png)

[unsafe](javascript:alert(1))
`);

	assert.match(html, /<strong>Comment heading<\/strong>/u);
	assert.doesNotMatch(html, /<h1|<script|<img|javascript:/u);
	assert.match(html, /&#x3C;script>.*&#x3C;\/script>/u);
});

void test("external comment links are labelled without marking same-site links", () => {
	const html = renderCommentBody(`
[external](https://example.com/path)

[local](https://crasnec.github.io/about/)
`);

	assert.match(html, /href="https:\/\/example\.com\/path"/u);
	assert.match(html, /data-external="true"/u);
	assert.match(html, /data-host="example\.com"/u);
	assert.match(html, /rel="nofollow ugc noopener noreferrer"/u);

	const localLink = /<a href="https:\/\/crasnec\.github\.io\/about\/">local<\/a>/u.exec(html);
	assert.ok(localLink, "same-site link should remain an ordinary link");
});
