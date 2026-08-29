import { Context, Effect, FileSystem, Path } from "effect";

import type { FilesystemWrite } from "./FilesystemWrite";
import { FilesystemWriteError } from "./FilesystemWriteError";
import {
	readFilesystemWritePathsFx,
	type FilesystemWritePaths,
} from "./internal/readFilesystemWritePathsFx";
import { removeFileFx } from "./internal/removeFileFx";
import { replaceFileFx } from "./internal/replaceFileFx";
import { withFilesystemLockFx } from "./internal/withFilesystemLockFx";

const HeldFilesystemWriteLocks = Context.Reference<ReadonlyMap<string, number>>(
	"Arkini/FilesystemWrite/HeldLocks",
	{
		defaultValue: () => new Map(),
	},
);

/** Creates the Node-only canonical lock and exact single-file write capability. */
export const createFilesystemWriteFx = Effect.fn("createFilesystemWriteFx")(function* () {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const provide = <Value, Failure, Requirements>(
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		effect.pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);
	const mapInternal = (operation: "lock" | "remove-file" | "replace-file") =>
		Effect.mapError((cause) =>
			cause instanceof FilesystemWriteError
				? cause
				: new FilesystemWriteError({
						operation,
						message: `Filesystem write operation ${operation} failed.`,
						cause,
					}),
		);
	const underLockFx = <Value, Failure, Requirements>(
		paths: FilesystemWritePaths,
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		Effect.gen(function* () {
			const held = yield* HeldFilesystemWriteLocks;
			const fiberId = yield* Effect.fiberId;
			if (held.get(paths.lock) === fiberId) return yield* effect;
			return yield* withFilesystemLockFx(
				paths.lock,
				effect.pipe(
					Effect.provideService(
						HeldFilesystemWriteLocks,
						new Map<string, number>(held).set(paths.lock, fiberId),
					),
				),
			);
		});
	const withLockFx: FilesystemWrite["withLockFx"] = (lock, effect) =>
		provide(
			readFilesystemWritePathsFx(lock).pipe(
				mapInternal("lock"),
				Effect.flatMap((paths) => underLockFx(paths, effect)),
			),
		);
	const replaceFile: FilesystemWrite["replaceFileFx"] = (props) =>
		provide(
			readFilesystemWritePathsFx(props.lock).pipe(
				mapInternal("replace-file"),
				Effect.flatMap((paths) =>
					underLockFx(
						paths,
						replaceFileFx({
							paths,
							props,
						}).pipe(mapInternal("replace-file")),
					),
				),
			),
		);
	const removeFile: FilesystemWrite["removeFileFx"] = (props) =>
		provide(
			readFilesystemWritePathsFx(props.lock).pipe(
				mapInternal("remove-file"),
				Effect.flatMap((paths) =>
					underLockFx(
						paths,
						removeFileFx({
							paths,
							props,
						}).pipe(mapInternal("remove-file")),
					),
				),
			),
		);
	return {
		withLockFx,
		removeFileFx: removeFile,
		replaceFileFx: replaceFile,
	} satisfies FilesystemWrite;
});
