import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkpackCatalog } from "./ArkpackCatalog";
import { installArkpackFx } from "./installArkpackFx";
import { listInstalledArkpacksFx } from "./listInstalledArkpacksFx";
import { readInstalledArkpackFx } from "./readInstalledArkpackFx";
import { removeInstalledArkpackFx } from "./removeInstalledArkpackFx";

export namespace createFilesystemArkpackCatalogFx {
	export interface Props {
		readonly userDataPath: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over the Electron Arkpack namespace. */
export const createFilesystemArkpackCatalogFx = Effect.fn("createFilesystemArkpackCatalogFx")(
	function* ({
		userDataPath,
		fileSystem: providedFileSystem,
	}: createFilesystemArkpackCatalogFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		const root = join(userDataPath, "arkini", "arkpacks");
		const readFx: ArkpackCatalog["readFx"] = Effect.fn("FilesystemArkpackCatalog.readFx")(
			(packageId) =>
				readInstalledArkpackFx({
					root,
					fileSystem,
					packageId,
				}),
		);
		const installFx: ArkpackCatalog["installFx"] = Effect.fn(
			"FilesystemArkpackCatalog.installFx",
		)((record) =>
			installArkpackFx({
				root,
				fileSystem,
				record,
			}),
		);
		const removeFx: ArkpackCatalog["removeFx"] = Effect.fn("FilesystemArkpackCatalog.removeFx")(
			(packageId) =>
				removeInstalledArkpackFx({
					root,
					fileSystem,
					packageId,
				}),
		);
		return {
			listFx: listInstalledArkpacksFx({
				root,
				fileSystem,
			}),
			readFx,
			installFx,
			removeFx,
		} satisfies ArkpackCatalog;
	},
);
