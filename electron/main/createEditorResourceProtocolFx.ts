import { net } from "electron";
import { pathToFileURL } from "node:url";
import { Effect, FileSystem, Path } from "effect";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { ArkiniProtocolError } from "../protocol/ArkiniProtocolError";
import { readResourceContentTypeFn } from "~/game-config-resource/fn/readResourceContentTypeFn";

export namespace createEditorResourceProtocolFx {
	export interface Props {
		readonly readResourceLocationFx: OwnedEditorProjectRepository["readResourceLocationFx"];
		readonly isTrustedUrlFn: (url: string) => boolean;
	}

	export interface Output {
		readonly handleRequestFx: (request: Request) => Effect.Effect<Response, never, never>;
	}
}

const unavailableFn = () =>
	new ArkiniProtocolError({
		status: 404,
		message: "Editor resource was not found.",
	});

/** Streams requested Editor resources directly from their registered filesystem paths. */
export const createEditorResourceProtocolFx = Effect.fn("createEditorResourceProtocolFx")(
	function* ({ readResourceLocationFx, isTrustedUrlFn }: createEditorResourceProtocolFx.Props) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;

		const handleRequestFx = Effect.fn("EditorResourceProtocol.handleRequestFx")(
			(request: Request) =>
				Effect.gen(function* () {
					if (request.method !== "GET" && request.method !== "HEAD") {
						return new Response("Method not allowed.", {
							status: 405,
						});
					}
					const origin = request.headers.get("Origin");
					if (
						(origin !== null && !isTrustedUrlFn(origin)) ||
						(request.referrer !== "" &&
							request.referrer !== "about:client" &&
							!isTrustedUrlFn(request.referrer))
					) {
						return new Response("Untrusted renderer origin.", {
							status: 403,
						});
					}
					const url = new URL(request.url);
					const projectId = url.searchParams.get("projectId");
					const resourceId = url.searchParams.get("resourceId");
					const version = url.searchParams.get("version");
					if (
						url.protocol !== "arkini:" ||
						url.host !== "app" ||
						url.pathname !== "/editor/resource" ||
						url.username !== "" ||
						url.password !== "" ||
						!projectId ||
						!resourceId ||
						!version ||
						Array.from(url.searchParams.keys()).length !== 3
					) {
						return yield* Effect.fail(unavailableFn());
					}
					const location = yield* readResourceLocationFx({
						projectId,
						resourceId,
					});
					if (location === null) return yield* Effect.fail(unavailableFn());
					if (location.version !== version) {
						return new Response("Editor resource version is outdated.", {
							status: 409,
						});
					}
					const root = yield* fs.realPath(location.root);
					const filePath = yield* fs.realPath(location.path);
					const relative = path.relative(root, filePath);
					if (
						relative === "" ||
						relative.startsWith("..") ||
						path.isAbsolute(relative) ||
						filePath !== path.resolve(root, path.relative(location.root, location.path))
					) {
						return yield* Effect.fail(unavailableFn());
					}
					const stat = yield* fs.stat(filePath);
					if (stat.type !== "File") return yield* Effect.fail(unavailableFn());
					const response = yield* Effect.tryPromise({
						try: () =>
							net.fetch(pathToFileURL(filePath).toString(), {
								method: request.method,
							}),
						catch: unavailableFn,
					});
					const headers = new Headers(response.headers);
					headers.set("Content-Type", readResourceContentTypeFn(location.type));
					if (!headers.has("Content-Length"))
						headers.set("Content-Length", String(Number(stat.size)));
					headers.set("Cache-Control", "no-store");
					if (origin !== null) {
						headers.set("Access-Control-Allow-Origin", origin);
						headers.set("Vary", "Origin");
					}
					headers.set("X-Content-Type-Options", "nosniff");
					return new Response(response.body, {
						status: response.status,
						headers,
					});
				}).pipe(
					Effect.catch((error) =>
						Effect.succeed(
							new Response(
								error instanceof ArkiniProtocolError
									? error.message
									: "Editor resource was not found.",
								{
									status:
										error instanceof ArkiniProtocolError ? error.status : 404,
								},
							),
						),
					),
				),
		);
		return {
			handleRequestFx,
		} satisfies createEditorResourceProtocolFx.Output;
	},
);
