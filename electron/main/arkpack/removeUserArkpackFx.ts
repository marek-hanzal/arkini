import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { ElectronMainError } from "../ElectronMainError";

export namespace removeUserArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
	}
}

/** Removes only the user copy so a bundled package with the same ID becomes visible again. */
export const removeUserArkpackFx = Effect.fn("removeUserArkpackFx")(
	({ root, fileSystem, packageId }: removeUserArkpackFx.Props) =>
		Effect.gen(function* () {
			const path = join(root, `${encodeURIComponent(packageId)}.arkpack`);
			yield* fileSystem.remove(path, {
				force: true,
			});
			yield* fileSystem.remove(join(root, `${encodeURIComponent(packageId)}.arksig`), {
				force: true,
			});
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "remove user Arkpack",
						cause,
					}),
			),
		),
);
