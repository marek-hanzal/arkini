import { Context, Effect, FileSystem, Path } from "effect";

import type { FilesystemWrite } from "./FilesystemWrite";
import { FilesystemWriteError } from "./FilesystemWriteError";
import {
	readFilesystemWritePathsFx,
	type FilesystemWritePaths,
} from "./internal/readFilesystemWritePathsFx";
import { recoverFilesystemWriteFx } from "./internal/recoverFilesystemWriteFx";
import { withFilesystemLockFx } from "./internal/withFilesystemLockFx";
import { writeFilesFx } from "./internal/writeFilesFx";

const HeldFilesystemWriteLocks = Context.Reference<ReadonlyMap<string, number>>(
	"Arkini/FilesystemWrite/HeldLocks",
	{
		defaultValue: () => new Map(),
	},
);

/** Creates the Node-only lock and crash-recoverable filesystem write capability. */
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
	const mapInternal = (operation: "lock" | "write-file" | "write-files") =>
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
		operation: "lock" | "write-file" | "write-files",
		effect: Effect.Effect<Value, Failure, Requirements>,
	) =>
		Effect.gen(function* () {
			const held = yield* HeldFilesystemWriteLocks;
			const fiberId = yield* Effect.fiberId;
			if (held.get(paths.lock) === fiberId) return yield* effect;
			return yield* withFilesystemLockFx(
				paths.lock,
				recoverFilesystemWriteFx(paths).pipe(
					mapInternal(operation),
					Effect.andThen(effect),
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
				Effect.flatMap((paths) => underLockFx(paths, "lock", effect)),
			),
		);
	const writeFiles: FilesystemWrite["writeFilesFx"] = (props) =>
		provide(
			readFilesystemWritePathsFx(props.lock).pipe(
				mapInternal("write-files"),
				Effect.flatMap((paths) =>
					underLockFx(
						paths,
						"write-files",
						writeFilesFx({
							operation: "write-files",
							paths,
							props,
						}).pipe(mapInternal("write-files")),
					),
				),
			),
		);
	const writeFile: FilesystemWrite["writeFileFx"] = ({ lock, target, bytes, mode }) =>
		provide(
			readFilesystemWritePathsFx(lock).pipe(
				mapInternal("write-file"),
				Effect.flatMap((paths) =>
					underLockFx(
						paths,
						"write-file",
						writeFilesFx({
							operation: "write-file",
							paths,
							props: {
								lock,
								root: path.dirname(path.resolve(lock)),
								writes: [
									{
										target,
										bytes,
										...(mode === undefined
											? {}
											: {
													mode,
												}),
									},
								],
							},
						}).pipe(mapInternal("write-file")),
					),
				),
			),
		);
	return {
		withLockFx,
		writeFileFx: writeFile,
		writeFilesFx: writeFiles,
	} satisfies FilesystemWrite;
});
