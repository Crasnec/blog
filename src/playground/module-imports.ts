import ts from "typescript";

/** Resolve npm names while keeping explicit URLs under the reader's control. */
export function resolveModuleSpecifier(specifier: string): string {
    if (specifier.startsWith("node:"))
    {
        throw new Error("Node.js built-in modules are unavailable in this browser worker.");
    }
    if (specifier.startsWith("npm:")) {
        specifier = specifier.slice(4);
    }
    else if (/^(?:[./]|[a-z][\w+.-]*:)/iu.test(specifier)) {
        return specifier;
    }
    if (!specifier || /\s/u.test(specifier)) {
        throw new Error("Invalid npm module specifier.");
    }
    const url = new URL(specifier, "https://esm.sh/");
    if (!url.searchParams.has("target")) {
        url.searchParams.set("target", "es2022");
    }
    return url.href;
}

/** Parse source so imports in strings, comments, and regular expressions stay intact. */
export function rewriteModuleImports(code: string): string {
    const source = ts.createSourceFile(
        "playground.js",
        code,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.JS,
    );
    const edits: { start: number; end: number; text: string }[] = [];
    function visit(node: ts.Node) {
        const specifier =
            ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
                ? node.moduleSpecifier
                : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
                    ? node.arguments[0]
                    : undefined;
        if (specifier && ts.isStringLiteralLike(specifier)) {
            const resolved = resolveModuleSpecifier(specifier.text);
            if (resolved !== specifier.text)
            {
                edits.push({
                    start: specifier.getStart(source),
                    end: specifier.getEnd(),
                    text: JSON.stringify(resolved),
                });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    for (const edit of edits.sort((a, b) => b.start - a.start))
    {
        code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
    }
    return code;
}
