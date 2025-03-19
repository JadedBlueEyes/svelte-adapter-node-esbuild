/* global ENV_PREFIX */
import process from "node:process";

export const expected = new Set([
	"SOCKET_PATH",
	"HOST",
	"PORT",
	"ORIGIN",
	"XFF_DEPTH",
	"ADDRESS_HEADER",
	"PROTOCOL_HEADER",
	"HOST_HEADER",
	"PORT_HEADER",
	"BODY_SIZE_LIMIT",
	"SHUTDOWN_TIMEOUT",
	"IDLE_TIMEOUT",
]);

const expected_unprefixed = new Set(["LISTEN_PID", "LISTEN_FDS"]);

export function env<T>(name: string, fallback: T): string | T {
	const prefix = expected_unprefixed.has(name) ? "" : ENV_PREFIX;
	const prefixed = prefix + name;
	return prefixed in process.env && process.env[prefixed] !== undefined
		? process.env[prefixed]
		: fallback;
}

export function env_map(name: string): { [key: string]: string } {
	const prefixed = ENV_PREFIX + name;
	const val: { [key: string]: string } = {};
	for (const key of Object.keys(process.env).filter((key) =>
		key.startsWith(prefixed),
	)) {
		if (process.env[key] !== undefined) {
			val[key.slice(prefixed.length)] = process.env[key];
		}
	}
	return val;
}
