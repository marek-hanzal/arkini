import { Effect, FileSystem, Path } from "effect";

import type { FilesystemWrite } from "../FilesystemWrite";
import { FilesystemWriteError } from "../FilesystemWriteError";
import { isFilesystemPathSafeFx } from "../isFilesystemPathSafeFx";
import { prepareFilesystemWriteTargetFx } from "../prepareFilesystemWriteTargetFx";
import type { FilesystemWritePaths } from "./readFilesystemWritePathsFx";

/** Syncs and atomically renames one exact sibling staging file over its owned target. */
export const replaceFileFx = Effect.fn("replaceFileFx")(function* ({
	paths,
	props,
}: {
	readonly paths: FilesystemWritePaths;
	readonly props: Parameters<FilesystemWrite["replaceFileFx"]>[0];
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const requestedRoot = path.dirname(path.resolve(props.lock));
	const prepared = yield* prepareFilesystemWriteTargetFx({
		operation: "replace-file",
		root: paths.parent,
		requestedRoot,
		target: props.target,
	});
	if (prepared.target === paths.lock)
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation: "replace-file",
				message: `Filesystem write target ${prepared.target} is the active lock.`,
			}),
		);
	const pending = `${prepared.target}.arkini-replace`;
	if (!(yield* isFilesystemPathSafeFx(fileSystem, paths.parent, pending)))
		return yield* Effect.fail(
			new FilesystemWriteError({
				operation: "replace-file",
				message: `Filesystem write staging file ${pending} must be canonical and must not be a symbolic link.`,
			}),
		);
	if (yield* fileSystem.exists(pending)) {
		const info = yield* fileSystem.stat(pending);
		if (info.type !== "File")
			return yield* Effect.fail(
				new FilesystemWriteError({
					operation: "replace-file",
					message: `Filesystem write staging file ${pending} must be canonical and must not be a symbolic link.`,
				}),
			);
		yield* fileSystem.remove(pending, {
			force: true,
		});
	}
	let ownsPending = false;
	return yield* Effect.uninterruptibleMask((restore) =>
		Effect.scoped(
			Effect.gen(function* () {
				const file = yield* fileSystem.open(pending, {
					flag: "wx",
				});
				ownsPending = true;
				yield* restore(file.writeAll(props.bytes));
				yield* restore(file.sync);
			}),
		).pipe(
			Effect.andThen(
				Effect.uninterruptible(
					fileSystem.rename(pending, prepared.target).pipe(
						Effect.tap(() =>
							Effect.sync(() => {
								ownsPending = false;
							}),
						),
					),
				),
			),
			Effect.ensuring(
				Effect.suspend(() =>
					ownsPending
						? fileSystem
								.remove(pending, {
									force: true,
								})
								.pipe(Effect.ignore)
						: Effect.void,
				),
			),
		),
	).pipe(
		Effect.mapError((cause) =>
			cause instanceof FilesystemWriteError
				? cause
				: new FilesystemWriteError({
						operation: "replace-file",
						message: "The atomic filesystem file replacement failed.",
						cause,
					}),
		),
	);
});
