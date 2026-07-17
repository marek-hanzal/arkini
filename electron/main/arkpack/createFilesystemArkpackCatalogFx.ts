import { FileSystem } from "@effect/platform";
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
		return {
			listFx: listInstalledArkpacksFx({
				root,
				fileSystem,
			}),
			readFx: (packageId) =>
				readInstalledArkpackFx({
					root,
					fileSystem,
					packageId,
				}),
			installFx: (record) =>
				installArkpackFx({
					root,
					fileSystem,
					record,
				}),
			removeFx: (packageId) =>
				removeInstalledArkpackFx({
					root,
					fileSystem,
					packageId,
				}),
		} satisfies ArkpackCatalog;
	},
);
