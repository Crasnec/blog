import type { AtRule, Plugin } from "postcss";

function descriptor(face: AtRule, property: string): string {
    let value = "";
    face.walkDecls(property, (declaration) => {
        value = declaration.value;
    });
    return value;
}

/** Keep repeated Unicode ranges close enough to share gzip's 32 KiB dictionary. */
export default function fontFaceGroups(): Plugin {
    return {
        postcssPlugin: "fontsource-korean-face-groups",
        OnceExit(root) {
            const faces: AtRule[] = [];
            root.walkAtRules("font-face", (face) => {
                const family = descriptor(face, "font-family").replace(/['"]/gu, "");
                if (family === "IBM Plex Sans KR") faces.push(face);
            });
            if (!faces.length) return;

            // Custom, nested, variable, or differently styled faces may depend on order.
            // Only interleave the package's complete matching sets of static weights.
            const weights = new Map<string, AtRule[]>();
            for (const face of faces) {
                const file = face.source?.input.file?.replaceAll("\\", "/") ?? "";
                const weight = descriptor(face, "font-weight");
                if (
                    face.parent !== root ||
                    !file.includes("/@fontsource/ibm-plex-sans-kr/") ||
                    !/^(400|500|600|700)$/u.test(weight) ||
                    descriptor(face, "font-style") !== "normal" ||
                    descriptor(face, "font-stretch") ||
                    !descriptor(face, "unicode-range")
                ) return;
                const group = weights.get(weight) ?? [];
                group.push(face);
                weights.set(weight, group);
            }

            const groups = [...weights.values()];
            const first = groups[0];
            if (!first || groups.length < 2) return;
            const ranges = first.map((face) => descriptor(face, "unicode-range"));
            if (new Set(ranges).size !== ranges.length) return;
            if (groups.some((group) =>
                group.length !== ranges.length ||
                group.some((face, index) => descriptor(face, "unicode-range") !== ranges[index]),
            )) return;

            const reordered = first.flatMap((_, index) => groups.flatMap((group) => {
                const face = group[index];
                return face ? [face.clone()] : [];
            }));
            faces.forEach((face, index) => {
                const replacement = reordered[index];
                if (replacement) face.replaceWith(replacement);
            });
        },
    };
}
