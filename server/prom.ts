import type { register } from "prom-client";
import type { Middleware, Request } from "polka";
import { env, env_map } from "./env";

export const prefix: string | undefined = env("METRICS_PREFIX", undefined);
export const labels = env_map("METRICS_LABEL_");

let localRegister: typeof register;
import("prom-client")
	.then((mod) => {
		const { collectDefaultMetrics, register } = mod.default;
		localRegister = register;
		collectDefaultMetrics({ prefix, labels });
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
