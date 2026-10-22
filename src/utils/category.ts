import { relative, resolve, sep } from "node:path";
import { slug } from "github-slugger";

export interface CategoryLink {
    /** Uses the same folder slugging as Astro post URLs. Encode only in links. */
    key: string;
    /** One directory name, exactly as authored. */
    name: string;
}

export interface Category extends CategoryLink {
    /** Every directory from the collection root through this category. */
    trail: CategoryLink[];
}

export interface CategoryCount extends Category {
    /** Includes posts in all descendant folders. */
    count: number;
    children: CategoryCount[];
}

/** Every directory below the collection root becomes a category level. */
export function categoryFromFile(filePath: string, root: string): Category {
    const path = relative(resolve(root), resolve(filePath));
    const segments = path.split(sep);
    if (!segments[0] || segments[0] === ".." || segments.length < 2) {
        throw new Error(`Post "${filePath}" must be inside a category folder below "${root}".`);
    }
    let key = "";
    const trail = segments.slice(0, -1).map((name) => {
        const segment = slug(name);
        if (!segment)
            throw new Error(`Category folder "${name}" must produce a nonempty URL slug.`);
        key = key ? `${key}/${segment}` : segment;
        return { key, name };
    });
    const leaf = trail.at(-1);
    if (!leaf) throw new Error(`Post "${filePath}" has no category folder.`);
    return { ...leaf, trail };
}

/** Inclusive subtree membership, with a slash boundary to keep siblings separate. */
export function categoryContains(parent: string, key: string): boolean {
    return parent === key || key.startsWith(`${parent}/`);
}

/** Encode individual segments so the hierarchy's slashes stay path separators. */
export function categoryPath(key: string): string {
    return `/categories/${key.split("/").map(encodeURIComponent).join("/")}/`;
}

export const categoryLabel = (category: Category): string =>
    category.trail.map(({ name }) => name).join(" / ");

/** Build a tree and count each post once at every level of its path. */
export function countCategories(categories: Iterable<Category>): CategoryCount[] {
    const roots: CategoryCount[] = [];
    const nodes = new Map<string, CategoryCount>();
    for (const { trail } of categories) {
        let siblings = roots;
        for (const [index, { key, name }] of trail.entries()) {
            let node = nodes.get(key);
            if (node && node.name !== name) {
                throw new Error(
                    `Category folders "${node.name}" and "${name}" share the URL "${key}". Rename one folder.`,
                );
            }
            if (!node) {
                node = { key, name, trail: trail.slice(0, index + 1), count: 0, children: [] };
                nodes.set(key, node);
                siblings.push(node);
            }
            node.count++;
            siblings = node.children;
        }
    }
    const sort = (siblings: CategoryCount[]): CategoryCount[] => {
        siblings.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const node of siblings) sort(node.children);
        return siblings;
    };
    return sort(roots);
}

/** All levels get a route, including parents with no directly filed posts. */
export function flattenCategories(categories: CategoryCount[]): CategoryCount[] {
    return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}
