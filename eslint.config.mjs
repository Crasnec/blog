import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import astroParser from "astro-eslint-parser";
import astro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

const scriptFiles = ["**/*.{js,cjs,mjs,ts,cts,mts}"];
const typedFiles = ["**/*.{ts,cts,mts}"];
/** @type {import("eslint").Linter.RulesRecord} */
const projectTypeRules = {
	"@typescript-eslint/consistent-type-imports": [
		"error",
		{ fixStyle: "inline-type-imports", prefer: "type-imports" },
	],
	"@typescript-eslint/no-import-type-side-effects": "error",
	"@typescript-eslint/switch-exhaustiveness-check": "error",
	"no-restricted-syntax": [
		"error",
		{
			selector: "TSUnknownKeyword",
			message:
				"Decode boundary data into an explicit domain type instead of propagating a top type.",
		},
	],
};

export default defineConfig([
	globalIgnores([
		".astro/**",
		".comments/**",
		".comments.tmp/**",
		"dist/**",
		"node_modules/**",
		"comments-repo/**",
	]),

	{
		name: "project/javascript",
		files: scriptFiles,
		extends: [js.configs.recommended],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: globals.node,
		},
	},

	{
		name: "project/typescript-type-checked",
		files: typedFiles,
		extends: [
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
		],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: projectTypeRules,
	},

	{
		name: "project/astro-generated-types",
		files: ["src/env.d.ts"],
		rules: {
			// Astro's generated content declarations are intentionally included by path.
			"@typescript-eslint/triple-slash-reference": "off",
		},
	},

	...astro.configs["flat/recommended"],
	...astro.configs["flat/jsx-a11y-strict"],

	{
		name: "project/astro",
		files: ["**/*.astro"],
		extends: [
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
		],
		languageOptions: {
			parser: astroParser,
			parserOptions: {
				parser: tseslint.parser,
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			...projectTypeRules,
			// Astro templates produce synthetic expression return and prop types that
			// these two rules report as unsafe even after `astro check` validates them.
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-return": "off",
		},
	},

	{
		name: "project/linter-hygiene",
		linterOptions: {
			reportUnusedDisableDirectives: "error",
			reportUnusedInlineConfigs: "error",
		},
	},
]);
