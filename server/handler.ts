import "./shims";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse as polka_url_parser } from "@polka/url";
import {
	createReadableStream,
	getRequest,
	setResponse,
} from "@sveltejs/kit/node";
import sirv from "sirv";

import type { IncomingHttpHeaders } from "node:http";
import { env } from "./env";
import { base, manifest, prerendered } from "MANIFEST";
import { Server } from "SERVER";
import type { Middleware } from "polka";

/* global ENV_PREFIX */

const server = new Server(manifest);

const origin = env("ORIGIN", undefined);
const xff_depth = Number.parseInt(env("XFF_DEPTH", "1"));
const address_header = env("ADDRESS_HEADER", "").toLowerCase();
const protocol_header = env("PROTOCOL_HEADER", "").toLowerCase();
const host_header = env("HOST_HEADER", "host").toLowerCase();
const port_header = env("PORT_HEADER", "").toLowerCase();

function parse_body_size_limit(bytes: string) {
	const multiplier =
		{
			K: 1024,
			M: 1024 * 1024,
			G: 1024 * 1024 * 1024,
		}[bytes[bytes.length - 1]?.toUpperCase()] ?? 1;
	return (
		Number(multiplier !== 1 ? bytes.substring(0, bytes.length - 1) : bytes) *
		multiplier
	);
}

const body_size_limit = parse_body_size_limit(env("BODY_SIZE_LIMIT", "512K"));

if (Number.isNaN(body_size_limit)) {
	throw new Error(
		`Invalid BODY_SIZE_LIMIT: '${env("BODY_SIZE_LIMIT", null)}'. Please provide a numeric value.`,
	);
}

const dir = path.dirname(fileURLToPath(import.meta.url));

const asset_dir = `${dir}/client${base}`;

await server.init({
	env: process.env as Record<string, string>,
	read: (file) => createReadableStream(`${asset_dir}/${file}`),
});

function serve(path: string, client = false) {
	return (
		fs.existsSync(path) &&
		sirv(path, {
			etag: true,
			gzip: true,
			brotli: true,
			setHeaders: client
				? (res, pathname) => {
						// only apply to build directory, not e.g. version.json
						if (
							pathname.startsWith(`/${manifest.appPath}/immutable/`) &&
							res.statusCode === 200
						) {
							res.setHeader(
								"cache-control",
								"public,max-age=31536000,immutable",
							);
						}
					}
				: undefined,
		})
	);
}

// required because the static file server ignores trailing slashes
function serve_prerendered(): Middleware {
	const handler = serve(path.join(dir, "prerendered"));
	if (typeof handler !== "function") {
		return (req, res, next) => {
			next();
		};
	}

	return (req, res, next) => {
		let { pathname, search, query } = polka_url_parser(req);

		try {
			pathname = decodeURIComponent(pathname);
		} catch {
			// ignore invalid URI
		}

		if (prerendered.has(pathname)) {
			return handler(req, res, next);
		}

		// remove or add trailing slash as appropriate
		let location =
			pathname.at(-1) === "/" ? pathname.slice(0, -1) : `${pathname}/`;
		if (prerendered.has(location)) {
			if (query) location += search;
			res.writeHead(308, { location }).end();
		} else {
			void next();
		}
	};
}

const ssr: Middleware = async (req, res) => {
	let request: Request;

	try {
		request = await getRequest({
			base: origin || get_origin(req.headers),
			request: req,
			bodySizeLimit: body_size_limit,
		});
	} catch {
		res.statusCode = 400;
		res.end("Bad Request");
		return;
	}

	await setResponse(
		res,
		await server.respond(request, {
			platform: { req },
			getClientAddress: () => {
				if (address_header) {
					if (!(address_header in req.headers)) {
						throw new Error(
							`Address header was specified with ${ENV_PREFIX}ADDRESS_HEADER=${address_header} but is absent from request`,
						);
					}

					let value = req.headers[address_header] || "";
					if (typeof value !== "string") {
						value = value.join(",");
					}
					if (address_header === "x-forwarded-for") {
						const addresses = value.split(",");

						if (xff_depth < 1) {
							throw new Error(
								`${ENV_PREFIX}XFF_DEPTH must be a positive integer`,
							);
						}

						if (xff_depth > addresses.length) {
							throw new Error(
								`${ENV_PREFIX}XFF_DEPTH is ${xff_depth}, but only found ${
									addresses.length
								} addresses`,
							);
						}
						return addresses[addresses.length - xff_depth].trim();
					}

					return value;
				}

				return (
					req.connection?.remoteAddress ||
					// @ts-expect-error
					req.connection?.socket?.remoteAddress ||
					req.socket?.remoteAddress ||
					// @ts-expect-error
					req.info?.remoteAddress
				);
			},
		}),
	);
};

function sequence(handlers: Middleware[]): Middleware {
	return (req, res, next) => {
		function handle(i: number): ReturnType<Middleware> {
			if (i < handlers.length) {
				return handlers[i](req, res, () => handle(i + 1));
			}
			return next();
		}

		return handle(0);
	};
}

function get_origin(headers: IncomingHttpHeaders) {
	const protocol = (protocol_header && headers[protocol_header]) || "https";
	const host = headers[host_header];
	const port = port_header && headers[port_header];
	if (port) {
		return `${protocol}://${host}:${port}`;
	}
	return `${protocol}://${host}`;
}

export const handler = sequence(
	[
		serve(path.join(dir, "client"), true),
		serve(path.join(dir, "static")),
		serve_prerendered(),
		ssr,
	].filter((x) => typeof x !== "boolean"),
);
