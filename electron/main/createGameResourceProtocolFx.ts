import { net } from "electron";
import { readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { z } from "zod";

import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";

const InstallationResourceSchema = z
	.object({
		contentHash: z.string().regex(/^[a-f0-9]{64}$/),
		packageId: z.string().min(1),
		resources: z.array(
			z
				.object({
					id: z.string(),
					mime: z.string(),
					path: z.string(),
					size: z.number().int().nonnegative(),
				})
				.strict(),
		),
	})
	.passthrough();

export namespace createGameResourceProtocolFx {
	export interface Props {
		readonly installationsRoot: string;
		readonly isTrustedUrlFn: (url: string) => boolean;
	}
}

/** Streams requested installed-game resources from the native filesystem. */
export const createGameResourceProtocolFx = Effect.fn("createGameResourceProtocolFx")(
	({ installationsRoot, isTrustedUrlFn }: createGameResourceProtocolFx.Props) =>
		Effect.succeed({
			handleRequestFx: (request: Request) =>
				Effect.tryPromise({
					try: async () => {
						if (request.method !== "GET" && request.method !== "HEAD")
							return new Response("Method not allowed.", {
								status: 405,
							});
						const origin = request.headers.get("Origin");
						if (
							(origin !== null && !isTrustedUrlFn(origin)) ||
							(request.referrer !== "" &&
								request.referrer !== "about:client" &&
								!isTrustedUrlFn(request.referrer))
						)
							return new Response("Untrusted renderer origin.", {
								status: 403,
							});
						const url = new URL(request.url);
						const packageId = url.searchParams.get("packageId");
						const contentHash = url.searchParams.get("contentHash");
						const resourceId = url.searchParams.get("resourceId");
						if (
							url.protocol !== "arkini:" ||
							url.host !== "app" ||
							url.pathname !== "/game/resource" ||
							!packageId ||
							!contentHash ||
							!resourceId ||
							Array.from(url.searchParams.keys()).length !== 3
						)
							return new Response("Game resource was not found.", {
								status: 404,
							});
						const root = join(
							installationsRoot,
							encodeGameProjectFileStemFn(packageId).replaceAll("%2E", "."),
							contentHash,
						);
						const installation = InstallationResourceSchema.parse(
							JSON.parse(await readFile(join(root, "installation.json"), "utf8")),
						);
						if (
							installation.packageId !== packageId ||
							installation.contentHash !== contentHash
						)
							return new Response("Game resource was not found.", {
								status: 404,
							});
						const resource = installation.resources.find(({ id }) => id === resourceId);
						if (resource === undefined)
							return new Response("Game resource was not found.", {
								status: 404,
							});
						const resourcePath = resolve(root, resource.path);
						const contained = relative(root, resourcePath);
						if (
							contained === "" ||
							contained.startsWith("..") ||
							resourcePath !== resolve(root, contained)
						)
							return new Response("Game resource was not found.", {
								status: 404,
							});
						const info = await stat(resourcePath);
						if (!info.isFile())
							return new Response("Game resource was not found.", {
								status: 404,
							});
						const range = request.headers.get("Range");
						const response = await net.fetch(pathToFileURL(resourcePath).toString(), {
							method: request.method,
							...(range === null
								? {}
								: {
										headers: {
											Range: range,
										},
									}),
						});
						const headers = new Headers(response.headers);
						headers.set("Content-Type", resource.mime);
						if (range === null && !headers.has("Content-Length"))
							headers.set("Content-Length", String(info.size));
						if (origin !== null) {
							headers.set("Access-Control-Allow-Origin", origin);
							headers.set("Vary", "Origin");
						}
						headers.set("X-Content-Type-Options", "nosniff");
						return new Response(response.body, {
							status: response.status,
							headers,
						});
					},
					catch: () => new Error("Game resource was not found."),
				}).pipe(
					Effect.catch(() =>
						Effect.succeed(
							new Response("Game resource was not found.", {
								status: 404,
							}),
						),
					),
				),
		}),
);
