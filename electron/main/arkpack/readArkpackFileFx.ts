import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";
import { verifyArkpackTrustFx } from "~/engine/pack/fx/verifyArkpackTrustFx";
import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

export namespace readArkpackFileFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
		readonly source: ArkiniElectronApi.ArkpackFile["source"];
		readonly verifyTrustFx?: (props: {
			readonly bytes: Uint8Array;
			readonly signature?: unknown;
		}) => Effect.Effect<ArkpackTrustSchema.Type>;
	}
}

/** Reads exact package bytes and offline-classifies its optional Sigstore bundle. */
export const readArkpackFileFx = Effect.fn("readArkpackFileFx")(
	({
		root,
		fileSystem,
		packageId,
		source,
		verifyTrustFx = verifyArkpackTrustFx,
	}: readArkpackFileFx.Props) =>
		Effect.gen(function* () {
			if (packageId.length === 0) return null;
			const stem = encodeGameProjectFileStem(packageId);
			const filename = `${stem}.arkpack`;
			const path = join(root, filename);
			if (!(yield* fileSystem.exists(path))) return null;
			const info = yield* fileSystem.stat(path);
			if (info.size > ArkpackLimits.maxCompressedBytes) {
				return yield* Effect.fail(
					new Error(
						`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
					),
				);
			}
			const bytes = yield* fileSystem.readFile(path);
			const signaturePath = join(root, `${stem}.arksig`);
			const signature = yield* fileSystem.exists(signaturePath).pipe(
				Effect.flatMap((exists) =>
					exists
						? fileSystem
								.stat(signaturePath)
								.pipe(
									Effect.flatMap((info) =>
										info.size <= ArkpackLimits.maxSignatureBytes
											? fileSystem.readFileString(signaturePath)
											: Effect.succeed(undefined),
									),
								)
						: Effect.succeed(undefined),
				),
				Effect.map((value) => value?.trim()),
				Effect.catch(() => Effect.succeed(undefined)),
			);
			const file: ArkiniElectronApi.ArkpackFile = {
				packageId,
				filename,
				bytes: Uint8Array.from(bytes),
				trust: yield* verifyTrustFx({
					bytes,
					signature,
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
