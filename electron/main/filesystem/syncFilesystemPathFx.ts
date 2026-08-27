import { FileSystem } from "effect";
import { Effect } from "effect";

/** Flushes one file or directory entry before a durable publication advances. */
export const syncFilesystemPathFx = Effect.fn("syncFilesystemPathFx")(function* (
	fileSystem: FileSystem.FileSystem,
	target: string,
) {
	yield* Effect.scoped(
		Effect.gen(function* () {
			const file = yield* fileSystem.open(target, {
				flag: "r",
			});
			yield* file.sync;
		}),
	);
});
