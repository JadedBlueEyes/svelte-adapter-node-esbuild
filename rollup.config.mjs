import { isBuiltin } from "node:module";
// rollup.config.js
import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";
import pkg from "./package.json" with { type: "json" };

import { builtinModules } from "node:module";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

const external = (id) =>
	isBuiltin(id) || pkg.dependencies[id] || pkg.peerDependencies[id];

const replacedModules = new Set([
	"ENV",
	"HANDLER",
	"MANIFEST",
	"SERVER",
	"SHIMS",
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

export default [
	{
		input: "src/index.ts",
		output: [
			{ file: pkg.exports.require, format: "cjs", sourcemap: true },
			{ file: pkg.exports.import, format: "es", sourcemap: true },
		],
		plugins: [typescript()],
		external,
	},
	{
		input: "src/index.ts",
		output: [{ file: pkg.exports.types, format: "es" }],
		plugins: [dts()],
		external,
	},
	// server components
	{
		input: "server/index.ts",
		output: {
			file: "files/index.js",
			format: "esm",
			sourcemap: true,
		},
		plugins: [
			nodeResolve({ preferBuiltins: true }),
			commonjs(),
			json(),
			prefixBuiltinModules(),
			typescript(),
		],
		external: externalRuntimeComponent,
	},
	{
		input: "server/index.ts",
		output: [{ file: "files/index.d.ts", format: "es" }],
		plugins: [
			nodeResolve({ preferBuiltins: true }),
			commonjs(),
			json(),
			prefixBuiltinModules(),
			dts(),
		],
		external: externalRuntimeComponent,
	},
	{
		input: "server/env.ts",
		output: {
			file: "files/env.js",
			format: "esm",
			sourcemap: true,
		},
		plugins: [
			nodeResolve(),
			commonjs(),
			json(),
			prefixBuiltinModules(),
			typescript(),
		],
		external: externalRuntimeComponent,
	},
	{
		input: "server/handler.ts",
		output: {
			file: "files/handler.js",
			format: "esm",
			inlineDynamicImports: true,
			sourcemap: true,
		},
		plugins: [
			nodeResolve(),
			commonjs(),
			json(),
			prefixBuiltinModules(),
			typescript(),
		],
		external: externalRuntimeComponent,
	},
	{
		input: "server/shims.ts",
		output: {
			file: "files/shims.js",
			format: "esm",
			sourcemap: true,
		},
		plugins: [nodeResolve(), commonjs(), prefixBuiltinModules(), typescript()],
		external: externalRuntimeComponent,
	},
];
