import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { ElectronMainError } from "../ElectronMainError";
import { assertImportedArkpackPackageIdFx } from "./assertImportedArkpackPackageIdFx";

export namespace removeInstalledArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
	}
}

/** Removes one exact imported Arkpack directory without touching saves. */
export const removeInstalledArkpackFx = Effect.fn("removeInstalledArkpackFx")(
	({ root, fileSystem, packageId }: removeInstalledArkpackFx.Props) =>
		Effect.gen(function* () {
			const id = yield* assertImportedArkpackPackageIdFx(packageId);
			yield* fileSystem.remove(join(root, id), {
				recursive: true,
				force: true,
			});
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof ElectronMainError
					? cause
					: new ElectronMainError({
							operation: "remove installed Arkpack",
							cause,
						}),
			),
		),
);
