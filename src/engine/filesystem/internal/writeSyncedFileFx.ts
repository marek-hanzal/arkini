import { Effect, FileSystem } from "effect";

/** Writes and syncs one already-contained staging or recovery file. */
export const writeSyncedFileFx = Effect.fn("writeSyncedFileFx")(function* ({
	bytes,
	target,
}: {
	readonly bytes: Uint8Array;
	readonly target: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	yield* Effect.scoped(
		Effect.gen(function* () {
			const file = yield* fileSystem.open(target, {
				flag: "wx",
			});
			yield* file.writeAll(bytes);
			yield* file.sync;
		}),
	);
});
