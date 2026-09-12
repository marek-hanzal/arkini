import { Effect, FileSystem, Option, Path, Semaphore } from "effect";
import type { OwnedEditorProjectRepository } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { readProjectResourceVersionFn } from "~/project-authoring/filesystem/fn/readProjectResourceVersionFn";
import { ArkiniProtocolError } from "../protocol/ArkiniProtocolError";

export namespace createEditorResourceProtocolFx {
	export interface Props {
		readonly readResourceLocationFx: OwnedEditorProjectRepository["readResourceLocationFx"];
		readonly isTrustedUrlFn: (url: string) => boolean;
		readonly maxCacheBytes?: number;
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

const readFileVersionFn = (stat: FileSystem.File.Info) =>
	readProjectResourceVersionFn({
		size: Number(stat.size),
		mtimeMs: Option.getOrUndefined(stat.mtime)?.getTime() ?? 0,
		birthtimeMs: Option.getOrUndefined(stat.birthtime)?.getTime() ?? 0,
		dev: stat.dev,
		ino: Option.getOrUndefined(stat.ino) ?? 0,
	});

/** Only requested PNGs enter this process-local cache; project saves never traverse it. */
export const createEditorResourceProtocolFx = Effect.fn("createEditorResourceProtocolFx")(
	function* ({
		readResourceLocationFx,
		isTrustedUrlFn,
		maxCacheBytes = 64 * 1024 * 1024,
	}: createEditorResourceProtocolFx.Props) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const reads = yield* Semaphore.make(4);
		const cache = new Map<string, Uint8Array<ArrayBuffer>>();
		const pending = new Map<
			string,
			Effect.Effect<Uint8Array<ArrayBuffer>, ArkiniProtocolError>
		>();
		let cacheBytes = 0;

		const readBytesFx = Effect.fn("EditorResourceProtocol.readBytesFx")(function* (
			filePath: string,
			version: string,
		) {
			const key = JSON.stringify([
				filePath,
				version,
			]);
			const cached = cache.get(key);
			if (cached !== undefined) {
				cache.delete(key);
				cache.set(key, cached);
				return cached;
			}
			const running = pending.get(key);
			if (running !== undefined) return yield* running;
			const readFx = yield* Effect.cached(
				Effect.gen(function* () {
					const bytes = new Uint8Array(yield* fs.readFile(filePath));
					const stat = yield* fs.stat(filePath);
					const currentVersion = readFileVersionFn(stat);
					if (currentVersion !== version) {
						return yield* Effect.fail(
							new ArkiniProtocolError({
								status: 409,
								message: "Editor resource changed while it was being read.",
							}),
						);
					}
					if (bytes.byteLength <= maxCacheBytes) {
						while (cacheBytes + bytes.byteLength > maxCacheBytes) {
							const oldest = cache.entries().next().value;
							if (oldest === undefined) break;
							cache.delete(oldest[0]);
							cacheBytes -= oldest[1].byteLength;
						}
						cache.set(key, bytes);
						cacheBytes += bytes.byteLength;
					}
					return bytes;
				}).pipe(
					reads.withPermits(1),
					Effect.mapError((error) =>
						error instanceof ArkiniProtocolError ? error : unavailableFn(),
					),
					Effect.ensuring(Effect.sync(() => pending.delete(key))),
				),
			);
			pending.set(key, readFx);
			return yield* readFx;
		});

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
						url.host !== "editor" ||
						url.pathname !== "/resource" ||
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
					const currentVersion = readFileVersionFn(stat);
					// Rollback may restore identical contents with fresh filesystem timestamps.
					// URL admission follows repository identity; cache freshness follows the live file.
					const headers = new Headers({
						"Content-Type": "image/png",
						"Content-Length": String(Number(stat.size)),
						"Cache-Control": "no-store",
						"X-Content-Type-Options": "nosniff",
					});
					if (origin !== null) {
						headers.set("Access-Control-Allow-Origin", origin);
						headers.set("Vary", "Origin");
					}
					const body =
						request.method === "HEAD"
							? null
							: yield* readBytesFx(filePath, currentVersion);
					const retainedLocation = yield* readResourceLocationFx({
						projectId,
						resourceId,
					});
					if (
						retainedLocation === null ||
						retainedLocation.version !== location.version ||
						retainedLocation.path !== location.path ||
						retainedLocation.root !== location.root
					) {
						return new Response("Editor resource changed while it was being read.", {
							status: 409,
						});
					}
					// The second repository lookup waits for an overlapping commit or rollback.
					// A failed commit can retain logical identity while replacing the physical file.
					if (readFileVersionFn(yield* fs.stat(filePath)) !== currentVersion) {
						return new Response("Editor resource changed while it was being read.", {
							status: 409,
						});
					}
					return new Response(body, {
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
