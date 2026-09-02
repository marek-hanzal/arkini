import { Effect, FileSystem } from "effect";

export const assertProjectFileFx = Effect.fn("assertProjectFileFx")(function* (
	fileSystem: FileSystem.FileSystem,
	target: string,
) {
	if (!(yield* fileSystem.exists(target))) return false;
	if ((yield* fileSystem.stat(target)).type !== "File")
		return yield* Effect.fail(new Error(`Editor project path ${target} must be a file.`));
	return true;
});
