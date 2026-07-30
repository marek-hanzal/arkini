import { FileSystem } from "effect";
import { Effect, Semaphore } from "effect";
import type { ArkpackCatalog } from "./ArkpackCatalog";
import { installArkpackFx } from "./installArkpackFx";
import { listInstalledArkpacksFx } from "./listInstalledArkpacksFx";
import { readInstalledArkpackFx } from "./readInstalledArkpackFx";
import { removeInstalledArkpackFx } from "./removeInstalledArkpackFx";

export namespace createFilesystemArkpackCatalogFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem?: FileSystem.FileSystem;
	}
}

/** Creates one narrow Effect-native capability over the Electron Arkpack namespace. */
export const createFilesystemArkpackCatalogFx = Effect.fn("createFilesystemArkpackCatalogFx")(
	function* ({
		root,
		fileSystem: providedFileSystem,
	}: createFilesystemArkpackCatalogFx.Props) {
		const fileSystem = providedFileSystem ?? (yield* FileSystem.FileSystem);
		// Publish and removal must retain admission order even when IPC callers overlap.
		const operations = yield* Semaphore.make(1);
		const readFx: ArkpackCatalog["readFx"] = Effect.fn("FilesystemArkpackCatalog.readFx")(
			(packageId) =>
				operations.withPermits(1)(
					readInstalledArkpackFx({
						root,
						fileSystem,
						packageId,
					}),
				),
		);
		const installFx: ArkpackCatalog["installFx"] = Effect.fn(
			"FilesystemArkpackCatalog.installFx",
		)((record) =>
			operations.withPermits(1)(
				installArkpackFx({
					root,
					fileSystem,
					record,
				}),
			),
		);
		const removeFx: ArkpackCatalog["removeFx"] = Effect.fn("FilesystemArkpackCatalog.removeFx")(
			(packageId) =>
				operations.withPermits(1)(
					removeInstalledArkpackFx({
						root,
						fileSystem,
						packageId,
					}),
				),
		);
		return {
			listFx: operations.withPermits(1)(
				listInstalledArkpacksFx({
					root,
					fileSystem,
				}),
			),
			readFx,
			installFx,
			removeFx,
		} satisfies ArkpackCatalog;
	},
);
