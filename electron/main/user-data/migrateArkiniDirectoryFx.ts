import { FileSystem } from "effect";
import { Effect } from "effect";
import { dirname, join } from "node:path";

export namespace migrateArkiniDirectoryFx {
	export interface Props {
		readonly destination: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly source: string;
	}
}

/** Moves one legacy path into its canonical location while preserving destination conflicts. */
export const migrateArkiniDirectoryFx = Effect.fn("migrateArkiniDirectoryFx")(function* ({
	destination,
	fileSystem,
	source,
}: migrateArkiniDirectoryFx.Props) {
	if (!(yield* fileSystem.exists(source))) return;
	if (!(yield* fileSystem.exists(destination))) {
		yield* fileSystem.makeDirectory(dirname(destination), {
			recursive: true,
		});
		yield* fileSystem.rename(source, destination);
		return;
	}

	const sourceInfo = yield* fileSystem.stat(source);
	const destinationInfo = yield* fileSystem.stat(destination);
	if (sourceInfo.type !== "Directory" || destinationInfo.type !== "Directory") return;

	for (const entry of yield* fileSystem.readDirectory(source)) {
		yield* migrateArkiniDirectoryFx({
			destination: join(destination, entry),
			fileSystem,
			source: join(source, entry),
		});
	}
	if ((yield* fileSystem.readDirectory(source)).length === 0) {
		yield* fileSystem.remove(source);
	}
});
