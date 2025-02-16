# SvelteKit Adapter for Node.js with ESBuild

## Introduction

This SvelteKit adapter allows you to run your SvelteKit application using Node.js with the ESBuild bundler.
It handles cases such as server assets and node native modules more gracefully than the original `@svelte/adapter-node`.

## Options

```ts
import type { BuildOptions } from 'esbuild';

type AdapterOptions = {
    // The output directory for the built application.
    out?: string;
    // Whether to precompress the output files with gzip and brotli.
    precompress?: boolean;
    // Prefix for environment variables.
    envPrefix?: string;
    // Options for the ESBuild bundler.
    esbuild?: BuildOptions;
};
```

## Environment Variables

You can customize various aspects of the server at runtime by modifying the environment variables:

- `SOCKET_PATH`: Path for the Unix domain socket. If not provided, an HTTP server will be used.
- `HOST`: The host address (default is `0.0.0.0`).
- `PORT`: The port number to listen on (only relevant if no `SOCKET_PATH` is set).
- `ORIGIN`: The origin header value.
- `PROTOCOL_HEADER`: The header informing SvelteKit the protocol it is being served.
- `HOST_HEADER`: The host header, as above.
- `PORT_HEADER`: The port header, as above.
- `ADDRESS_HEADER`: The header informing SvelteKit the original client address.
- `XFF_DEPTH`: If `ADDRESS_HEADER` is set to `X-Forwarded-For`, the amount of trusted proxies in front of the server.
- `BODY_SIZE_LIMIT`: The body size limit, in bytes. Can also set with a unit suffix (e.g., `10M` for 10 megabytes).
- `SHUTDOWN_TIMEOUT`: Timeout in seconds before forcefully closing connections after SIGTERM or SIGINT.
- `IDLE_TIMEOUT`: Number of seconds until the app automatically sleeps when using socket activation.
