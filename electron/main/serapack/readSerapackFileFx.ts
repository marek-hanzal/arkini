import { Effect, type FileSystem } from "effect";
import { join } from "node:path";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { ElectronMainError } from "../ElectronMainError";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
import { readSerapackFileConfigFx } from "~/serapack-artifact/fx/readSerapackFileConfigFx";
import { readSerapackFileLayoutFx } from "~/serapack-artifact/fx/readSerapackFileLayoutFx";
import { verifySerapackFileProvenanceFx } from "~/serapack-artifact/fx/verifySerapackFileProvenanceFx";
import type { SerapackProvenanceSchema } from "~/serapack-artifact/schema/SerapackProvenanceSchema";

export namespace readSerapackFileFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
		readonly source: SerakkiElectronApi.SerapackFile["source"];
		readonly verifyProvenanceFx?: (props: {
			readonly serapackPath: string;
		}) => Effect.Effect<SerapackProvenanceSchema.Type, never, never>;
	}
}

/** Inspects one exact package without loading its resource bodies. */
export const readSerapackFileFx = Effect.fn("readSerapackFileFx")(
	({ root, fileSystem, packageId, source, verifyProvenanceFx }: readSerapackFileFx.Props) =>
		Effect.gen(function* () {
			if (packageId.length === 0) return null;
			const filename = readSerapackArtifactNameFn(packageId);
			const serapackPath = join(root, filename);
			if (!(yield* fileSystem.exists(serapackPath))) return null;
			const layout = yield* readSerapackFileLayoutFx(serapackPath);
			const config = yield* readSerapackFileConfigFx(layout);
			if (config.meta.id !== packageId)
				return yield* Effect.fail(
					new Error(
						`Serapack was addressed as package ${packageId}, but its config declares ${config.meta.id}.`,
					),
				);
			const provenance =
				verifyProvenanceFx === undefined
					? yield* verifySerapackFileProvenanceFx(layout)
					: yield* verifyProvenanceFx({
							serapackPath,
						});
			return {
				packageId,
				filename,
				contentHash: layout.contentHash,
				title: config.meta.title,
				version: layout.manifest.version,
				serakki: layout.manifest.serakki,
				projectRevision: layout.manifest.projectRevision,
				provenance,
				source,
				overridesBundled: false,
			} satisfies SerakkiElectronApi.SerapackFile;
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: `read ${source} Serapack`,
						cause,
					}),
			),
		),
);
