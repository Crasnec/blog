/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ViteTypeOptions {
	strictImportMetaEnv: true;
}

interface ImportMetaEnv {
	readonly PUBLIC_COMMENTS_REPO?: string;
	readonly PUBLIC_COMMENTS_TOKEN?: string;
}
