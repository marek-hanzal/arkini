import { Effect, FileSystem, Path } from "effect";

import { FilesystemWriteError } from "../FilesystemWriteError";

export interface FilesystemWritePaths {
	readonly lock: string;
	readonly parent: string;
	readonly active: string;
	readonly cleanup: string;
}

/** Canonicalizes one explicit lock and rejects a symbolic-link lock boundary. */
export const readFilesystemWritePathsFx = Effect.fn("readFilesystemWritePathsFx")(function* (
	requestedLock: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const requestedParent = path.dirname(path.resolve(requestedLock));
	yield* fileSystem.makeDirectory(requestedParent, {
		recursive: true,
	});
	const parent = yield* fileSystem.realPath(requestedParent);
	const lock = path.join(parent, path.basename(requestedLock));
	if (yield* fileSystem.exists(lock)) {
		const info = yield* fileSystem.stat(lock);
		if (info.type !== "File" || (yield* fileSystem.realPath(lock)) !== lock)
			return yield* Effect.fail(
				new FilesystemWriteError({
					operation: "lock",
					message: `Filesystem write lock ${lock} must be a canonical file.`,
				}),
			);
	}
	return {
		lock,
		parent,
		active: `${lock}.write`,
		cleanup: `${lock}.write.cleanup`,
	} satisfies FilesystemWritePaths;
});
