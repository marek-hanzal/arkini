import { Effect, FileSystem, Path } from "effect";

import { FilesystemWriteError } from "../FilesystemWriteError";
import { isFilesystemPathSafeFx } from "../isFilesystemPathSafeFx";

const isContained = (path: Path.Path, root: string, target: string) => {
	const relative = path.relative(root, target);
	return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};

/** Creates and verifies one canonical parent below the exact owned root. */
export const prepareFilesystemWriteTargetFx = Effect.fn("prepareFilesystemWriteTargetFx")(
	function* ({
		operation,
		root,
		requestedRoot,
		target: requestedTarget,
	}: {
		readonly operation: "write-file" | "write-files";
		readonly root: string;
		readonly requestedRoot: string;
		readonly target: string;
	}) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const resolvedTarget = path.resolve(requestedTarget);
		if (!isContained(path, requestedRoot, resolvedTarget))
			return yield* Effect.fail(
				new FilesystemWriteError({
					operation,
					message: `Filesystem write target ${resolvedTarget} is outside ${requestedRoot}.`,
				}),
			);
		const target = path.join(root, path.relative(requestedRoot, resolvedTarget));
		const parent = path.dirname(target);
		const segments = path.relative(root, parent).split(path.sep).filter(Boolean);
		let directory = root;
		for (const segment of segments) {
			directory = path.join(directory, segment);
			if (!(yield* fileSystem.exists(directory))) {
				yield* fileSystem.makeDirectory(directory);
				continue;
			}
			const info = yield* fileSystem.stat(directory);
			if (
				info.type !== "Directory" ||
				!(yield* isFilesystemPathSafeFx(fileSystem, root, directory))
			)
				return yield* Effect.fail(
					new FilesystemWriteError({
						operation,
						message: `Filesystem write directory ${directory} must be canonical and must not be a symbolic link.`,
					}),
				);
		}
		if (yield* fileSystem.exists(target)) {
			const info = yield* fileSystem.stat(target);
			if (info.type !== "File" || !(yield* isFilesystemPathSafeFx(fileSystem, root, target)))
				return yield* Effect.fail(
					new FilesystemWriteError({
						operation,
						message: `Filesystem write target ${target} must be canonical and must not be a symbolic link.`,
					}),
				);
		}
		return {
			target,
		};
	},
);
