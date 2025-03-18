import { isBuiltin } from "node:module";
// rollup.config.js
import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json" with { type: "json" };

import { builtinModules } from "node:module";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const external = (id) =>
	isBuiltin(id) || pkg.dependencies[id] || pkg.peerDependencies[id];

const replacedModules = new Set([
	"MANIFEST",
	"SERVER",
]);

const externalRuntimeComponent = (id) =>
	(isBuiltin(id) && id.startsWith("node:")) ||
	pkg.peerDependencies[id] ||
	replacedModules.has(id);

function prefixBuiltinModules() {
	return {
		resolveId(source) {
			if (builtinModules.includes(source)) {
				return { id: `node:${source}`, external: true };
			}
		},
	};
}

/**
 * @type {import('@rollup/plugin-typescript').RollupTypescriptOptions}
 */
const serverTypescriptOptions = {
	tsconfig: "./tsconfig.server.json",
	declaration: true,
	declarationDir: "./files",
};

export default [
	{
		input: "src/index.ts",
		output: [
			{ file: pkg.exports.require, format: "cjs", sourcemap: true },
			{ file: pkg.exports.import, format: "es", sourcemap: true },
		],
		plugins: [typescript({ declarationDir: "./dist", declaration: true, })],
		external,
	},
	// server components
	{
		input: ["server/index.ts", "server/env.ts", "server/handler.ts", "server/shims.ts"],
		output: {
			dir: "files",
			format: "esm",
			sourcemap: true,
			paths: {
				"MANIFEST": "./server/manifest.js",
				"SERVER": "./server/index.js",
			},
			chunkFileNames: "chunk-[name]-[hash].js",
			// preserveModules: true,
		},
		preserveEntrySignatures: "strict",
		plugins: [
			nodeResolve({ preferBuiltins: true }),
			commonjs(),
			json(),
			prefixBuiltinModules(),
			typescript(serverTypescriptOptions),
		],
		external: externalRuntimeComponent,
	}
];
