import ts from "typescript";

/** Syntax diagnostics are reported; this is transpilation, not type checking. */
export function transpileTypeScript(code: string): string {
    const result = ts.transpileModule(code, {
        fileName: "playground.ts",
        reportDiagnostics: true,
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            verbatimModuleSyntax: true,
        },
    });
    const errors =
        result.diagnostics?.filter(
            (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
        ) ?? [];
    if (errors.length)
    {
        throw new SyntaxError(
            errors
                .map((diagnostic) => {
                    const position = diagnostic.file?.getLineAndCharacterOfPosition(
                        diagnostic.start ?? 0,
                    );
                    return `${position ? `${String(position.line + 1)}:${String(position.character + 1)}: ` : ""}${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
                })
                .join("\n"),
        );
    }
    return result.outputText;
}
