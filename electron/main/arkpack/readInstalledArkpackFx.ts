import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";
import { assertImportedArkpackPackageIdFx } from "./assertImportedArkpackPackageIdFx";
import { parseInstalledArkpackDescriptorFx } from "./parseInstalledArkpackDescriptorFx";

export namespace readInstalledArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
	}
}

/** Reads one exact installed Arkpack descriptor and binary. */
export const readInstalledArkpackFx = Effect.fn("readInstalledArkpackFx")(
	({ root, fileSystem, packageId }: readInstalledArkpackFx.Props) =>
		Effect.gen(function* () {
			const id = yield* assertImportedArkpackPackageIdFx(packageId);
			const directory = join(root, id);
			if (!(yield* fileSystem.exists(directory))) return null;
			const [metadata, bytes] = yield* Effect.all(
				[
					fileSystem.readFileString(join(directory, "descriptor.json")),
					fileSystem.readFile(join(directory, "package.arkpack")),
				] as const,
				{
					concurrency: "unbounded",
				},
			);
			const descriptor = yield* Effect.try({
				try: () => JSON.parse(metadata) as unknown,
				catch: (cause) =>
					new ElectronMainError({
						operation: "parse installed Arkpack descriptor JSON",
						cause,
					}),
			}).pipe(
				Effect.flatMap((value) =>
					parseInstalledArkpackDescriptorFx({
						value,
						expectedPackageId: id,
					}),
				),
			);
			return {
				descriptor,
				bytes: Uint8Array.from(bytes),
			} satisfies ArkiniElectronApi.ArkpackRecord;
		}).pipe(
			Effect.mapError((cause) =>
				cause instanceof ElectronMainError
					? cause
					: new ElectronMainError({
							operation: "read installed Arkpack",
							cause,
						}),
			),
		),
);
