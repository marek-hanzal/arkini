import { Effect, FileSystem, Path } from "effect";

export interface FilesystemWritePaths {
	readonly lock: string;
	readonly parent: string;
	readonly active: string;
	readonly cleanup: string;
}

/** Canonicalizes one explicit lock below its real parent directory. */
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
	return {
		lock,
		parent,
		active: `${lock}.write`,
		cleanup: `${lock}.write.cleanup`,
	} satisfies FilesystemWritePaths;
});
