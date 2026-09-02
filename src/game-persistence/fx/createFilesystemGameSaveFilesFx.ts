import { Data, Effect, FileSystem } from "effect";
import { join } from "node:path";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import type { FilesystemWrite } from "~/filesystem-write/service/FilesystemWrite";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

class GameSaveFilesError extends Data.TaggedError("GameSaveFilesError")<{
	readonly operation:
		| "access game save"
		| "clear game save"
		| "Invalid Arkini save identity"
		| "read game save"
		| "write game save";
	readonly cause: unknown;
}> {
	override get message(): string {
		return `Game save filesystem operation failed: ${this.operation}`;
	}
}

interface GameSaveFiles {
	readonly readFx: (
		key: GameSaveStorage.Key,
	) => Effect.Effect<Uint8Array | null, GameSaveFilesError, never>;
	readonly writeFx: (
		key: GameSaveStorage.Key,
		bytes: Uint8Array,
	) => Effect.Effect<void, GameSaveFilesError, never>;
	readonly clearFx: (key: GameSaveStorage.Key) => Effect.Effect<void, GameSaveFilesError, never>;
}

interface Props {
	readonly root: string;
	readonly fileSystem?: FileSystem.FileSystem;
}

const readGameSaveDirectoryNameFx = Effect.fn("readGameSaveDirectoryNameFx")(function* (
	key: GameSaveStorage.Key,
) {
	const parsed = IdSchema.safeParse(key.packageId);
	if (parsed.success) return encodeGameProjectFileStemFn(parsed.data);
	return yield* Effect.fail(
		new GameSaveFilesError({
			operation: "Invalid Arkini save identity",
			cause: key,
		}),
	);
});

const mapGameSaveFilesErrorFn =
	(operation: GameSaveFilesError["operation"]) =>
	(cause: unknown): GameSaveFilesError =>
		cause instanceof GameSaveFilesError
			? cause
			: new GameSaveFilesError({
					operation,
					cause,
				});

const readGameSaveFx = ({
	root,
	fileSystem,
	directoryName,
}: {
	readonly root: string;
	readonly fileSystem: FileSystem.FileSystem;
	readonly directoryName: string;
}) =>
	Effect.gen(function* () {
		const path = join(root, directoryName, "current.arksave");
		if (!(yield* fileSystem.exists(path))) return null;
		return Uint8Array.from(yield* fileSystem.readFile(path));
	}).pipe(Effect.mapError(mapGameSaveFilesErrorFn("read game save")));

const writeGameSaveFx = ({
	root,
	filesystemWrite,
	key,
	bytes,
}: {
	readonly root: string;
	readonly filesystemWrite: FilesystemWrite;
	readonly key: GameSaveStorage.Key;
	readonly bytes: Uint8Array;
}) =>
	readGameSaveDirectoryNameFx(key).pipe(
		Effect.flatMap((directoryName) =>
			filesystemWrite.replaceFileFx({
				lock: join(root, `.${directoryName}.lock`),
				target: join(root, directoryName, "current.arksave"),
				bytes,
			}),
		),
		Effect.mapError(mapGameSaveFilesErrorFn("write game save")),
	);

const clearGameSaveFx = ({
	root,
	fileSystem,
	directoryName,
}: {
	readonly root: string;
	readonly fileSystem: FileSystem.FileSystem;
	readonly directoryName: string;
}) =>
	fileSystem
		.remove(join(root, directoryName), {
			recursive: true,
			force: true,
		})
		.pipe(Effect.mapError(mapGameSaveFilesErrorFn("clear game save")));

/** Creates one narrow Effect-native capability over the Electron save namespace. */
export const createFilesystemGameSaveFilesFx = Effect.fn("createFilesystemGameSaveFilesFx")(
	function* ({ root, fileSystem: providedFileSystem }: Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
		const withKeyLockFx = <Value, Failure, Requirements>(
			key: GameSaveStorage.Key,
			operationFx: (directoryName: string) => Effect.Effect<Value, Failure, Requirements>,
		) =>
			readGameSaveDirectoryNameFx(key).pipe(
				Effect.flatMap((directory) =>
					filesystemWrite.withLockFx(
						join(root, `.${directory}.lock`),
						operationFx(directory),
					),
				),
				Effect.mapError(mapGameSaveFilesErrorFn("access game save")),
			);
		const readFx: GameSaveFiles["readFx"] = Effect.fn("FilesystemGameSaveFiles.readFx")((key) =>
			withKeyLockFx(key, (directoryName) =>
				readGameSaveFx({
					root,
					fileSystem,
					directoryName,
				}),
			),
		);
		const writeFx: GameSaveFiles["writeFx"] = Effect.fn("FilesystemGameSaveFiles.writeFx")(
			(key, bytes) =>
				writeGameSaveFx({
					root,
					filesystemWrite,
					key,
					bytes,
				}),
		);
		const clearFx: GameSaveFiles["clearFx"] = Effect.fn("FilesystemGameSaveFiles.clearFx")(
			(key) =>
				withKeyLockFx(key, (directoryName) =>
					clearGameSaveFx({
						root,
						fileSystem,
						directoryName,
					}),
				),
		);
		return {
			readFx,
			writeFx,
			clearFx,
		} satisfies GameSaveFiles;
	},
);
