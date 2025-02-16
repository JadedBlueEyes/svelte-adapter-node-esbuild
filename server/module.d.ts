declare module "SERVER" {
	export { Server } from "@sveltejs/kit";
}

declare module "MANIFEST" {
	import type { SSRManifest } from "@sveltejs/kit";

	export const manifest: SSRManifest;
	export const prerendered: Map<string, { file: string }>;
	export const base: string;
}

declare module "ENV" {
	export { env, expected } from "./env.ts";
}
declare module "HANDLER" {
	export { handler } from "./handler.ts";
}
declare module "@polka/url";
