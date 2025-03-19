import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Adapter } from "@sveltejs/kit";
import { type BuildOptions, build } from "esbuild";
import assetImportMetaUrl from "esbuild-plugin-asset-import-meta-url";
const files = fileURLToPath(new URL("./../files", import.meta.url).href);

type AdapterOptions = {
	out?: string;
	precompress?: boolean;
	envPrefix?: string;
	esbuild?: BuildOptions;
};

// https://github.com/evanw/esbuild/pull/2067
const ESM_REQUIRE_SHIM = `
await (async () => {
  const { dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  /**
   * Shim entry-point related paths.
   */
  if (typeof globalThis.__filename === "undefined") {
    globalThis.__filename = fileURLToPath(import.meta.url);
  }
  if (typeof globalThis.__dirname === "undefined") {
    globalThis.__dirname = dirname(globalThis.__filename);
  }
  /**
   * Shim require if needed.
   */
  if (typeof globalThis.require === "undefined") {
    const { default: module } = await import("module");
    globalThis.require = module.createRequire(import.meta.url);
  }
})();
`;

export default function (opts: AdapterOptions = {}): Adapter {
	const { out = "build", precompress = true, envPrefix = "" } = opts;

	return {
		name: "svelte-adapter-node-esbuild",

		async adapt(builder) {
			const tmp = builder.getBuildDirectory("adapter-node-esbuild");

			builder.rimraf(out);
			builder.rimraf(tmp);
			builder.mkdirp(tmp);

			builder.log.minor("Copying assets");
			builder.writeClient(`${out}/client${builder.config.kit.paths.base}`);
			builder.writePrerendered(
				`${out}/prerendered${builder.config.kit.paths.base}`,
			);

			if (precompress) {
				builder.log.minor("Compressing assets");
				await Promise.all([
					builder.compress(`${out}/client`),
					builder.compress(`${out}/prerendered`),
				]);
			}

			builder.log.minor("Building server");
			const serverDir = builder.getServerDirectory();
			builder.mkdirp(`${tmp}/server`);
			await cp(serverDir, `${tmp}/server`, { recursive: true });
			await writeFile(
				`${tmp}/server/manifest.js`,
				[
					`export const manifest = ${builder.generateManifest({ relativePath: "./" })};`,
					`export const prerendered = new Set(${JSON.stringify(builder.prerendered.paths)});`,
					`export const base = ${JSON.stringify(builder.config.kit.paths.base)};`,
				].join("\n\n"),
			);

			builder.copy(files, tmp, {});

			await mkdir(`${out}/server`);
			await mkdir(`${out}/server/assets`);

			await build({
				format: "esm",
				platform: "node",
				target: "node22.0",
				bundle: true,
				splitting: true,
				sourcemap: true,
				...opts.esbuild,
				chunkNames: "server/chunks/[name]-[hash]",
				outbase: tmp,
				entryPoints: [
					`${tmp}/server/index.js`,
					`${tmp}/server/manifest.js`,
					...(await readdir(tmp))
						.filter(
							(file) => file.endsWith(".js") && !file.startsWith("chunk-"),
						)
						.map((file) => `${tmp}/${file}`),
				],
				outdir: `${out}`,
				assetNames: "server/assets/[name]-[hash]",
				plugins: [
					assetImportMetaUrl({
						fileName: "server/assets/[name].[extname]",
					}),
					...(opts.esbuild?.plugins || []),
				],
				banner: {
					...opts.esbuild?.banner,
					js: ESM_REQUIRE_SHIM + (opts.esbuild?.banner?.js || ""),
				},
				loader: {
					".node": "copy",
					...opts.esbuild?.loader,
				},
			});
			// For some reason this wasin't working, so we're doing it manually instead
			// builder.copy(tmp, out, {
			// 	filter: (path) => path.endsWith(".d.ts"),
			// }));
			await readdir(files).then((fileNames) => {
				for (const file of fileNames.filter((file) => file.endsWith(".d.ts"))) {
					builder.copy(`${files}/${file}`, `${out}/${file}`);
				}
			});
		},

		supports: {
			read: () => true,
		},
	};
}
