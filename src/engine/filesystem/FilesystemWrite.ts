import type { Effect, FileSystem, Path } from "effect";

import type { FilesystemWriteError } from "./FilesystemWriteError";

export interface FilesystemWrite {
	readonly withLockFx: <Value, Failure, Requirements>(
		lock: string,
		effect: Effect.Effect<Value, Failure, Requirements>,
	) => Effect.Effect<
		Value,
		Failure | FilesystemWriteError,
		Exclude<Exclude<Requirements, FileSystem.FileSystem>, Path.Path>
	>;
	readonly writeFileFx: (
		props: FilesystemWrite.File,
	) => Effect.Effect<void, FilesystemWriteError>;
	readonly writeFilesFx: (
		props: FilesystemWrite.Files,
	) => Effect.Effect<void, FilesystemWriteError>;
}

export namespace FilesystemWrite {
	export interface Write {
		readonly target: string;
		readonly bytes: Uint8Array;
	}

	export interface File extends Write {
		readonly lock: string;
	}

	export interface Files {
		readonly lock: string;
		readonly root: string;
		readonly writes: ReadonlyArray<Write>;
		readonly deletes?: ReadonlyArray<string>;
	}
}
