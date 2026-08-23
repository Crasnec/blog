/**
 * One social card per post, plus one per locale for everything that is not a
 * post — the index, the archive, the tag pages and the about page all share it,
 * because none of them has a headline of its own worth setting large.
 *
 * A locked post still gets a card. Its title, date and tags are already public
 * on every listing, so withholding them here would protect nothing; what the
 * card leaves off is what the page leaves off — the reading time, which
 * describes a body nobody is meant to have yet.
 */
import { longDate } from "../../utils/format";
import { t } from "../../strings";
import type { APIRoute, GetStaticPaths } from "astro";
import { siteConfig } from "../../config";
import { type PostRef, getPosts, postMeta } from "../../utils/content";
import { renderCard } from "../../utils/og";

interface Props {
	post?: PostRef;
}

export const getStaticPaths: GetStaticPaths = async () => {
	const posts = await getPosts();

	return [
		{ params: { path: "site" }, props: {} },
		...posts.map((post) => ({
			params: { path: post.path },
			props: { post },
		})),
	];
};

export const GET: APIRoute<Props> = async ({ props: { post } }) => {

	const body = post
		? await postCard(post)
		: await renderCard({
				headline: siteConfig.title,
				sub: siteConfig.subtitle,
				nameplate: true,
			});

	return new Response(new Uint8Array(body), {
		headers: { "Content-Type": "image/png" },
	});
};

async function postCard(post: PostRef): Promise<Buffer> {
	const { entry } = post;
	const locked = Boolean(entry.data.sealed);
	const { readingTime } = await postMeta(entry);

	const meta = [
		longDate(entry.data.published),
		!locked && readingTime !== undefined
			? `${String(readingTime)} ${t("post.readingTime")}`
			: null,
		entry.data.tags.length > 0 ? entry.data.tags.join(", ") : null,
	].filter((part): part is string => part !== null);

	return renderCard({
		headline: entry.data.title,
		meta,
		...(locked ? { badge: t("secret.mark") } : {}),
	});
}
