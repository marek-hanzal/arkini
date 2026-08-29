import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { ElectronMainError } from "../ElectronMainError";
import { readArkpackArtifactNameFn } from "~/arkpack/artifact/fn/readArkpackArtifactNameFn";
import { withArkpackFileLockFx } from "./withArkpackFileLockFx";

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
			const path = join(root, readArkpackArtifactNameFn(packageId));
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			yield* withArkpackFileLockFx(
				{
					arkpackPath: path,
					fileSystem,
				},
				(canonicalPath) =>
					Effect.gen(function* () {
						yield* fileSystem.remove(canonicalPath, {
							force: true,
						});
					}),
			);
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
