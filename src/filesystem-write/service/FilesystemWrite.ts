import type { Effect, FileSystem, Path } from "effect";

import type { FilesystemWriteError } from "../error/FilesystemWriteError";

export interface FilesystemWrite {
	readonly withLockFx: <Value, Failure, Requirements>(
		lock: string,
		effect: Effect.Effect<Value, Failure, Requirements>,
	) => Effect.Effect<
		Value,
		Failure | FilesystemWriteError,
		Exclude<Exclude<Requirements, FileSystem.FileSystem>, Path.Path>
	>;
	readonly replaceFileFx: (props: {
		readonly lock: string;
		readonly target: string;
		readonly bytes: Uint8Array;
	}) => Effect.Effect<void, FilesystemWriteError, never>;
	/** Replaces independently publishable files under one lock without aggregate rollback. */
	readonly replaceIndependentFilesFx: (props: {
		readonly lock: string;
		readonly files: ReadonlyArray<{
			readonly target: string;
			readonly bytes: Uint8Array;
		}>;
		readonly concurrency: number;
	}) => Effect.Effect<void, FilesystemWriteError, never>;
	readonly removeFileFx: (props: {
		readonly lock: string;
		readonly target: string;
	}) => Effect.Effect<void, FilesystemWriteError, never>;
}
