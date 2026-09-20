import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { ElectronMainError } from "../ElectronMainError";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
import { withSerapackFileLockFx } from "./withSerapackFileLockFx";

export namespace removeUserSerapackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
	}
}

/** Removes only the user copy so a bundled package with the same ID becomes visible again. */
export const removeUserSerapackFx = Effect.fn("removeUserSerapackFx")(
	({ root, fileSystem, packageId }: removeUserSerapackFx.Props) =>
		Effect.gen(function* () {
			const path = join(root, readSerapackArtifactNameFn(packageId));
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			yield* withSerapackFileLockFx(
				{
					serapackPath: path,
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
						operation: "remove user Serapack",
						cause,
					}),
			),
		),
);
