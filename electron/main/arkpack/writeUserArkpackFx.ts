import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { writeArkpackArtifactPairFx } from "./writeArkpackArtifactPairFx";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

export namespace writeUserArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly record: ArkiniElectronApi.ArkpackInstall;
	}
}

/** Atomically installs one validated package into the user-preferred root. */
export const writeUserArkpackFx = Effect.fn("writeUserArkpackFx")(
	({ root, fileSystem, record }: writeUserArkpackFx.Props) =>
		Effect.gen(function* () {
			const signature = yield* Effect.try({
				try: () =>
					record.signature === undefined
						? undefined
						: ArkpackSignatureSchema.parse(record.signature),
				catch: (cause) =>
					new Error("The Arkpack signature is invalid.", {
						cause,
					}),
			});
			if (record.packageId.length === 0) {
				return yield* Effect.fail(new Error("Arkpack package identity is empty."));
			}
			if (record.bytes.byteLength > ArkpackLimits.maxCompressedBytes) {
				return yield* Effect.fail(
					new Error(
						`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
					),
				);
			}
			const stem = encodeGameProjectFileStem(record.packageId);
			yield* writeArkpackArtifactPairFx({
				arkpackPath: join(root, `${stem}.arkpack`),
				bytes: record.bytes,
				fileSystem,
				signature,
			});
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "install user Arkpack",
						cause,
					}),
			),
		),
);
