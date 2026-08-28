import { Effect, FileSystem, Path } from "effect";

import type { FilesystemWrite } from "../FilesystemWrite";
import { FilesystemWriteError } from "../FilesystemWriteError";
import { prepareFilesystemWriteTargetFx } from "../prepareFilesystemWriteTargetFx";
import type { FilesystemWritePaths } from "./readFilesystemWritePathsFx";

/** Removes one exact owned regular file without recursive deletion. */
export const removeFileFx = Effect.fn("removeFileFx")(function* ({
	paths,
	props,
}: {
	readonly paths: FilesystemWritePaths;
	readonly props: Parameters<FilesystemWrite["removeFileFx"]>[0];
}) {
	const path = yield* Path.Path;
	const prepared = yield* prepareFilesystemWriteTargetFx({
		operation: "remove-file",
		root: paths.parent,
		requestedRoot: path.dirname(path.resolve(props.lock)),
		target: props.target,
	});
	if (prepared.target === paths.lock)
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation: "remove-file",
				message: `Filesystem write target ${prepared.target} is the active lock.`,
			}),
		);
	yield* (yield* FileSystem.FileSystem).remove(prepared.target, {
		force: true,
	});
});
