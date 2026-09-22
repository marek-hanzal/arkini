import { Clock, Data, Effect, FileSystem, Option } from "effect";
import { join } from "node:path";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";
import type { GameSaveStorage } from "~/game-persistence/service/GameSaveStorage";

class GameSaveFilesError extends Data.TaggedError("GameSaveFilesError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {
	override get message(): string {
		return `Game save filesystem operation failed: ${this.operation}`;
	}
}
interface Props {
	readonly root: string;
	readonly fileSystem?: FileSystem.FileSystem;
}

export interface FilesystemGameSaveFiles extends GameSaveStorage {
	readonly snapshotFx: (
		key: GameSaveStorage.Key,
	) => Effect.Effect<readonly FilesystemGameSaveFiles.Snapshot[], unknown, never>;
}

export namespace FilesystemGameSaveFiles {
	export interface Snapshot {
		readonly slot: GameSaveSlotSchema.Type;
		readonly savedAt: number;
		readonly bytes: Uint8Array;
	}
}
const intervals = {
	"5-min": 300_000,
	"30-min": 1_800_000,
	"4-hour": 14_400_000,
} as const;

/** All slots share one package lock; each timestamp is published atomically with its bytes. */
export const createFilesystemGameSaveFilesFx = Effect.fn("createFilesystemGameSaveFilesFx")(
	function* ({ root, fileSystem: providedFileSystem }: Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const filesystemWrite = yield* createFilesystemWriteFx().pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
		);
		const withKeyLockFx = <A, E>(
			key: GameSaveStorage.Key,
			operationFx: (directory: string) => Effect.Effect<A, E>,
		) =>
			Effect.gen(function* () {
				if (!IdSchema.safeParse(key?.packageId).success)
					return yield* Effect.fail(
						new GameSaveFilesError({
							operation: "Invalid Serakki save identity",
							cause: key,
						}),
					);
				const name = encodeGameProjectFileStemFn(key.packageId);
				return yield* filesystemWrite.withLockFx(
					join(root, `.${name}.lock`),
					operationFx(join(root, name)),
				);
			}).pipe(
				Effect.mapError((cause) =>
					cause instanceof GameSaveFilesError
						? cause
						: new GameSaveFilesError({
								operation: "access game save",
								cause,
							}),
				),
			);
		const pathFx = (directory: string, slot: GameSaveSlotSchema.Type) =>
			Effect.gen(function* () {
				const parsed = GameSaveSlotSchema.safeParse(slot);
				if (!parsed.success)
					return yield* Effect.fail(
						new GameSaveFilesError({
							operation: "invalid save slot",
							cause: slot,
						}),
					);
				return join(directory, `${parsed.data}.serasave`);
			});
		const readSlotFx = (directory: string, slot: GameSaveSlotSchema.Type) =>
			Effect.gen(function* () {
				const path = yield* pathFx(directory, slot);
				return (yield* fileSystem.exists(path))
					? Uint8Array.from(yield* fileSystem.readFile(path))
					: null;
			});
		const timestampFx = (directory: string, slot: GameSaveSlotSchema.Type) =>
			Effect.gen(function* () {
				const path = yield* pathFx(directory, slot);
				if (!(yield* fileSystem.exists(path))) return null;
				return Option.match((yield* fileSystem.stat(path)).mtime, {
					onNone: () => null,
					onSome: (date) => date.getTime(),
				});
			});
		const replaceFx = (
			directory: string,
			slot: GameSaveSlotSchema.Type,
			bytes: Uint8Array,
			now: number,
		) =>
			Effect.gen(function* () {
				if (!(bytes instanceof Uint8Array))
					return yield* Effect.fail(
						new GameSaveFilesError({
							operation: "invalid save bytes",
							cause: bytes,
						}),
					);
				const target = yield* pathFx(directory, slot);
				const pending = `${target}.pending`;
				yield* fileSystem.makeDirectory(directory, {
					recursive: true,
				});
				// The package lock owns this fixed temporary path. Failed writes never truncate a live slot.
				yield* Effect.gen(function* () {
					yield* fileSystem.writeFile(pending, bytes);
					yield* fileSystem.utimes(pending, new Date(now), new Date(now));
					yield* fileSystem.rename(pending, target);
				}).pipe(
					Effect.mapError(
						(cause) =>
							new GameSaveFilesError({
								operation: `replace ${slot} save`,
								cause,
							}),
					),
					Effect.ensuring(
						fileSystem
							.remove(pending, {
								force: true,
							})
							.pipe(Effect.ignore),
					),
				);
			});
		const readFx = (key: GameSaveStorage.Key, slot: GameSaveSlotSchema.Type = "current") =>
			withKeyLockFx(key, (directory) => readSlotFx(directory, slot));
		const writeFx = (
			key: GameSaveStorage.Key,
			bytes: Uint8Array,
			slot: "current" | "manual" = "current",
		) =>
			withKeyLockFx(key, (directory) =>
				Effect.gen(function* () {
					if (slot !== "current" && slot !== "manual")
						return yield* Effect.fail(
							new GameSaveFilesError({
								operation: "invalid writable save slot",
								cause: slot,
							}),
						);
					const now = yield* Clock.currentTimeMillis;
					yield* replaceFx(directory, slot, bytes, now);
					if (slot === "manual") return;
					for (const checkpoint of [
						"5-min",
						"30-min",
						"4-hour",
					] as const) {
						const savedAt = yield* timestampFx(directory, checkpoint);
						if (savedAt === null || now - savedAt >= intervals[checkpoint])
							yield* replaceFx(directory, checkpoint, bytes, now);
					}
				}),
			);
		const listFx = (key: GameSaveStorage.Key) =>
			withKeyLockFx(key, (directory) =>
				Effect.forEach(GameSaveSlotSchema.options, (slot) =>
					timestampFx(directory, slot).pipe(
						Effect.map((savedAt) => ({
							slot,
							savedAt,
						})),
					),
				),
			);
		const snapshotFx = (key: GameSaveStorage.Key) =>
			withKeyLockFx(key, (directory) =>
				Effect.gen(function* () {
					const snapshot: FilesystemGameSaveFiles.Snapshot[] = [];
					for (const slot of GameSaveSlotSchema.options) {
						const bytes = yield* readSlotFx(directory, slot);
						if (bytes === null) continue;
						snapshot.push({
							slot,
							savedAt: (yield* timestampFx(directory, slot)) ?? 0,
							bytes,
						});
					}
					return snapshot;
				}),
			);
		const restoreFx = (key: GameSaveStorage.Key, bytes: Uint8Array) =>
			withKeyLockFx(key, (directory) =>
				Effect.gen(function* () {
					yield* replaceFx(directory, "current", bytes, yield* Clock.currentTimeMillis);
				}),
			);
		const clearFx = (key: GameSaveStorage.Key) =>
			withKeyLockFx(key, (directory) =>
				fileSystem.remove(directory, {
					recursive: true,
					force: true,
				}),
			);
		return {
			readFx,
			writeFx,
			listFx,
			snapshotFx,
			restoreFx,
			clearFx,
		} satisfies FilesystemGameSaveFiles;
	},
);
