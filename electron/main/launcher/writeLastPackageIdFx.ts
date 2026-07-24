import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { LastPackageIdSchema } from "../../../desktop/launcher/LastPackageIdSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace writeLastPackageIdFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: LastPackageIdSchema.Type;
	}
}

/** Atomically persists the package ID of the last successfully bootstrapped Game. */
export const writeLastPackageIdFx = Effect.fn("writeLastPackageIdFx")(function* ({
	root,
	fileSystem,
	packageId,
}: writeLastPackageIdFx.Props) {
	const validPackageId = yield* Effect.try({
		try: () => LastPackageIdSchema.parse(packageId),
		catch: (cause) =>
			new ElectronMainError({
				operation: "persist the last package preference",
				cause,
			}),
	});
	const pending = join(root, "launcher-last-package.pending");
	const current = join(root, "launcher.last-package");
	yield* fileSystem
		.makeDirectory(root, {
			recursive: true,
		})
		.pipe(
			Effect.zipRight(fileSystem.writeFileString(pending, validPackageId)),
			Effect.zipRight(
				fileSystem.rename(pending, current).pipe(
					Effect.ensuring(
						fileSystem
							.remove(pending, {
								force: true,
							})
							.pipe(Effect.ignore),
					),
				),
			),
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "persist the last package preference",
						cause,
					}),
			),
		);
});
