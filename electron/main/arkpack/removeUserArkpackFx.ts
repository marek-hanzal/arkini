import { FileSystem } from "effect";
import { Effect } from "effect";
import { dirname, join } from "node:path";
import { ElectronMainError } from "../ElectronMainError";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";
import { readArkpackSignaturePathFx } from "~/engine/pack/fx/readArkpackSignaturePathFx";
import { syncFilesystemPathFx } from "../filesystem/syncFilesystemPathFx";
import { withRecoveredArkpackArtifactPairFx } from "./recoverArkpackArtifactPairFx";

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
			const stem = encodeGameProjectFileStem(packageId);
			const path = join(root, `${stem}.arkpack`);
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			yield* withRecoveredArkpackArtifactPairFx(
				{
					arkpackPath: path,
					fileSystem,
				},
				(canonicalPath) =>
					Effect.gen(function* () {
						yield* fileSystem.remove(canonicalPath, {
							force: true,
						});
						yield* fileSystem.remove(yield* readArkpackSignaturePathFx(canonicalPath), {
							force: true,
						});
						yield* syncFilesystemPathFx(fileSystem, dirname(canonicalPath));
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
