import { Effect, type FileSystem } from "effect";
import { join } from "node:path";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { readArkpackFileConfigFx } from "~/arkpack-artifact/fx/readArkpackFileConfigFx";
import { readArkpackFileLayoutFx } from "~/arkpack-artifact/fx/readArkpackFileLayoutFx";
import { verifyArkpackFileProvenanceFx } from "~/arkpack-artifact/fx/verifyArkpackFileProvenanceFx";
import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";

export namespace readArkpackFileFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
		readonly source: ArkiniElectronApi.ArkpackFile["source"];
		readonly verifyProvenanceFx?: (props: {
			readonly arkpackPath: string;
		}) => Effect.Effect<ArkpackProvenanceSchema.Type, never, never>;
	}
}

/** Inspects one exact package without loading its resource bodies. */
export const readArkpackFileFx = Effect.fn("readArkpackFileFx")(
	({ root, fileSystem, packageId, source, verifyProvenanceFx }: readArkpackFileFx.Props) =>
		Effect.gen(function* () {
			if (packageId.length === 0) return null;
			const filename = readArkpackArtifactNameFn(packageId);
			const arkpackPath = join(root, filename);
			if (!(yield* fileSystem.exists(arkpackPath))) return null;
			const layout = yield* readArkpackFileLayoutFx(arkpackPath);
			const config = yield* readArkpackFileConfigFx(layout);
			if (config.meta.id !== packageId)
				return yield* Effect.fail(
					new Error(
						`Arkpack was addressed as package ${packageId}, but its config declares ${config.meta.id}.`,
					),
				);
			const provenance =
				verifyProvenanceFx === undefined
					? yield* verifyArkpackFileProvenanceFx(layout)
					: yield* verifyProvenanceFx({
							arkpackPath,
						});
			return {
				packageId,
				filename,
				contentHash: layout.contentHash,
				title: config.meta.title,
				version: layout.manifest.version,
				arkini: layout.manifest.arkini,
				provenance,
				source,
				overridesBundled: false,
			} satisfies ArkiniElectronApi.ArkpackFile;
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: `read ${source} Arkpack`,
						cause,
					}),
			),
		),
);
