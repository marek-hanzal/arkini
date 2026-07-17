import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { assertImportedArkpackPackageIdFx } from "./assertImportedArkpackPackageIdFx";

export namespace removeInstalledArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
	}
}

/** Removes one exact imported Arkpack directory without touching saves. */
export const removeInstalledArkpackFx = Effect.fn("removeInstalledArkpackFx")(function* ({
	root,
	fileSystem,
	packageId,
}: removeInstalledArkpackFx.Props) {
	const id = yield* assertImportedArkpackPackageIdFx(packageId);
	yield* fileSystem.remove(join(root, id), {
		recursive: true,
		force: true,
	});
});
