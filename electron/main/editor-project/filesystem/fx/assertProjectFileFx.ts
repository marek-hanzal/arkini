import { Effect, FileSystem } from "effect";

import { isFilesystemPathSafeFx } from "~/engine/filesystem/isFilesystemPathSafeFx";

export const assertProjectFileFx = Effect.fn("assertProjectFileFx")(function* (
	fileSystem: FileSystem.FileSystem,
	root: string,
	target: string,
) {
	if (!(yield* fileSystem.exists(target))) return false;
	if (
		!(yield* isFilesystemPathSafeFx(fileSystem, root, target)) ||
		(yield* fileSystem.stat(target)).type !== "File"
	)
		return yield* Effect.fail(
			new Error(`Editor project file ${target} must not be a symbolic link.`),
		);
	return true;
});
