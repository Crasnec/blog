import { relative, resolve, sep } from "node:path";
import { slug } from "github-slugger";

export interface Category {
	/** Uses the same folder slugging as Astro post URLs. Encode only in links. */
	key: string;
	/** The first directory below the collection root, exactly as authored. */
	name: string;
}

export interface CategoryCount extends Category {
	count: number;
}

/** Nested subfolders remain part of a post's URL, not additional categories. */
export function categoryFromFile(filePath: string, root: string): Category {
	const path = relative(resolve(root), resolve(filePath));
	const segments = path.split(sep);
	const name = segments[0];
	if (!name || name === ".." || segments.length < 2) {
		throw new Error(`Post "${filePath}" must be inside a category folder below "${root}".`);
	}
	const key = slug(name);
	if (!key) throw new Error(`Category folder "${name}" must produce a nonempty URL slug.`);
	return { key, name };
}

/** Reject ambiguous URLs instead of silently combining differently named folders. */
export function countCategories(categories: Iterable<Category>): CategoryCount[] {
	const counts = new Map<string, CategoryCount>();
	for (const { key, name } of categories) {
		const existing = counts.get(key);
		if (existing && existing.name !== name) {
			throw new Error(`Category folders "${existing.name}" and "${name}" share the URL "${key}". Rename one folder.`);
		}
		if (existing) existing.count++;
		else counts.set(key, { key, name, count: 1 });
	}
	return [...counts.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
