import type { register } from "prom-client";
import type { Middleware, Request } from "polka";
import { env } from "./env";

let localRegister: typeof register;
import("prom-client")
	.then((mod) => {
		const { collectDefaultMetrics, register } = mod.default;
		localRegister = register;
		collectDefaultMetrics();
	})
	.catch((error) => {
		if (env("METRICS_PATH", false)) {
			console.error(error);
		}
	});

const metrics: Middleware<Request> = async (req, res, next) => {
	try {
		res.appendHeader("Content-Type", localRegister.contentType);
		res.end(await localRegister.metrics());
	} catch (ex) {
		res.statusCode = 500;
		// res.statusMessage = ex?.message ?? ex;
		res.end();
	}
};

export { metrics };
