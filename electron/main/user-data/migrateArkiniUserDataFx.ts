import { FileSystem } from "effect";
import { Effect } from "effect";

import { ElectronMainError } from "../ElectronMainError";
import type { ArkiniUserDataPaths } from "./ArkiniUserDataPaths";
import { migrateArkiniDirectoryFx } from "./migrateArkiniDirectoryFx";

export namespace migrateArkiniUserDataFx {
	export interface Props {
		readonly fileSystem?: FileSystem.FileSystem;
		readonly paths: ArkiniUserDataPaths;
	}
}

/** Normalizes legacy Arkini persistence below explicit game and editor user-data roots. */
export const migrateArkiniUserDataFx = Effect.fn("migrateArkiniUserDataFx")(function* ({
	fileSystem: providedFileSystem,
	paths,
}: migrateArkiniUserDataFx.Props) {
	const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
	const migrations = [
		[paths.legacy.arkpacks, paths.game.arkpacks],
		[paths.legacy.logs, paths.game.logs],
		[paths.legacy.preferences, paths.game.preferences],
		[paths.legacy.saves, paths.game.saves],
	] as const;

	for (const [source, destination] of migrations) {
		yield* migrateArkiniDirectoryFx({
			destination,
			fileSystem,
			source,
		});
	}
	yield* fileSystem.makeDirectory(paths.game.root, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(paths.editor, {
		recursive: true,
	});
}).pipe(
	Effect.mapError(
		(cause) =>
			new ElectronMainError({
				operation: "Normalize Arkini user data",
				cause,
			}),
	),
);
