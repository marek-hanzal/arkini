import { Effect, FileSystem } from "effect";

/** Writes, modes and syncs one already-contained staging or recovery file. */
export const writeSyncedFileFx = Effect.fn("writeSyncedFileFx")(function* ({
	bytes,
	mode,
	target,
}: {
	readonly bytes: Uint8Array;
	readonly mode?: number;
	readonly target: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	yield* Effect.scoped(
		Effect.gen(function* () {
			const file = yield* fileSystem.open(target, {
				flag: "wx",
				...(mode === undefined
					? {}
					: {
							mode,
						}),
			});
			yield* file.writeAll(bytes);
			yield* file.sync;
		}),
	);
	if (mode !== undefined) yield* fileSystem.chmod(target, mode);
});
