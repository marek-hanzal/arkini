import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";
import { verifyArkpackProvenanceFx } from "~/engine/pack/fx/verifyArkpackProvenanceFx";
import type { ArkpackProvenanceSchema } from "~/engine/pack/schema/ArkpackProvenanceSchema";

export namespace readArkpackFileFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
		readonly source: ArkiniElectronApi.ArkpackFile["source"];
		readonly verifyProvenanceFx?: (props: {
			readonly bytes: Uint8Array;
		}) => Effect.Effect<ArkpackProvenanceSchema.Type>;
	}
}

/** Reads one exact package and offline-classifies its embedded proof. */
export const readArkpackFileFx = Effect.fn("readArkpackFileFx")(
	({
		root,
		fileSystem,
		packageId,
		source,
		verifyProvenanceFx = verifyArkpackProvenanceFx,
	}: readArkpackFileFx.Props) =>
		Effect.gen(function* () {
			if (packageId.length === 0) return null;
			const stem = encodeGameProjectFileStem(packageId);
			const filename = `${stem}.arkpack`;
			const path = join(root, filename);
			if (!(yield* fileSystem.exists(path))) return null;
			const info = yield* fileSystem.stat(path);
			if (info.size > ArkpackLimits.maxArkpackBytes) {
				return yield* Effect.fail(
					new Error(`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`),
				);
			}
			const bytes = yield* fileSystem.readFile(path);
			const file: ArkiniElectronApi.ArkpackFile = {
				packageId,
				filename,
				bytes: Uint8Array.from(bytes),
				provenance: yield* verifyProvenanceFx({
					bytes,
				}),
				source,
				overridesBundled: false,
			};
			return file;
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
