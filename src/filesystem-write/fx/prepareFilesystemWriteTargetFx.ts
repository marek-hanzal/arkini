import { Effect, FileSystem, Path } from "effect";

import { FilesystemWriteError } from "../error/FilesystemWriteError";

/** Resolves one contained target and creates missing parents only for writes. */
export const prepareFilesystemWriteTargetFx = Effect.fn("prepareFilesystemWriteTargetFx")(
	function* ({
		operation,
		root,
		requestedRoot,
		target: requestedTarget,
	}: {
		readonly operation: "remove-file" | "replace-file" | "write-files";
		readonly root: string;
		readonly requestedRoot: string;
		readonly target: string;
	}) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const resolvedTarget = path.resolve(requestedTarget);
		const requestedRelative = path.relative(requestedRoot, resolvedTarget);
		if (
			requestedRelative === "" ||
			requestedRelative.startsWith("..") ||
			path.isAbsolute(requestedRelative)
		)
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
				if (operation === "remove-file")
					return {
						target,
					};
				yield* fileSystem.makeDirectory(directory);
				continue;
			}
			const info = yield* fileSystem.stat(directory);
			if (info.type !== "Directory")
				return yield* Effect.fail(
					new FilesystemWriteError({
						operation,
						message: `Filesystem write directory ${directory} must be a directory.`,
					}),
				);
		}
		if (yield* fileSystem.exists(target)) {
			const info = yield* fileSystem.stat(target);
			if (info.type !== "File")
				return yield* Effect.fail(
					new FilesystemWriteError({
						operation,
						message: `Filesystem write target ${target} must be a file.`,
					}),
				);
		}
		return {
			target,
		};
	},
);
