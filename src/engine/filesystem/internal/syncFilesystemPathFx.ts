import { Effect, FileSystem } from "effect";

/** Flushes one file or directory before a durable filesystem write advances. */
export const syncFilesystemPathFx = Effect.fn("syncFilesystemPathFx")(function* (target: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (process.platform === "win32" && (yield* fileSystem.stat(target)).type === "Directory")
		return;
	yield* Effect.scoped(
		Effect.gen(function* () {
			const file = yield* fileSystem.open(target, {
				flag: "r",
			});
			yield* file.sync;
		}),
	);
});
