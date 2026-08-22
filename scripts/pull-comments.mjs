import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";

/**
 * Pulls the comment store into `.comments/` so the build can read it as a
 * content collection.
 *
 * Comments live in their own public repository, not in this one. Keeping them
 * separate is what makes the whole design work: a comment arriving is a commit
 * to a data-only repo that triggers no site build, spam never lands in this
 * repo's history, and if the store is ever flooded it can be thrown away and
 * recreated without touching the blog.
 *
 * Pass `--if-missing` to skip the network when a copy is already present, and
 * to treat a failed fetch as a warning. That is what `predev` and `precheck`
 * use — working offline should not stop you working. `prebuild` refreshes every
 * time and fails hard, because a build that quietly drops every comment would
 * become the live site at the next deploy.
 */

const DIR = ".comments";
const repo = process.env.PUBLIC_COMMENTS_REPO?.trim();
const ifMissing = process.argv.includes("--if-missing");

if (!repo) {
	// Comments are optional. A checkout without them still has to build.
	if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
	console.log("comments: PUBLIC_COMMENTS_REPO is not set — building without comments");
	process.exit(0);
}

if (ifMissing && existsSync(`${DIR}/.git`)) {
	console.log(`comments: ${DIR} already present — skipping fetch`);
	process.exit(0);
}

const url = repo.startsWith("http") ? repo : `https://github.com/${repo}.git`;

const TMP = `${DIR}.tmp`;

try {
	// Clone aside and swap, so a failed fetch leaves the copy already on disk
	// alone instead of deleting it on the way to erroring out.
	rmSync(TMP, { recursive: true, force: true });
	execFileSync("git", ["clone", "--depth", "1", "--quiet", url, TMP], {
		stdio: ["ignore", "inherit", "inherit"],
	});
	rmSync(DIR, { recursive: true, force: true });
	renameSync(TMP, DIR);
	console.log(`comments: fetched from ${repo}`);
} catch (error) {
	rmSync(TMP, { recursive: true, force: true });
	console.error(`comments: could not fetch ${repo}`);
	console.error(error instanceof Error ? error.message : error);

	// Strict for a build, forgiving for dev — see the note at the top.
	if (!ifMissing) process.exit(1);
	if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
	console.warn("comments: carrying on with whatever is already on disk");
}
