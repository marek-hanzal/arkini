import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";

export namespace readArkpackFileFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
		readonly source: ArkiniElectronApi.ArkpackFile["source"];
	}
}

/** Reads one convention-named package and its optional detached signature. */
export const readArkpackFileFx = Effect.fn("readArkpackFileFx")(
	({ root, fileSystem, packageId, source }: readArkpackFileFx.Props) =>
		Effect.gen(function* () {
			if (packageId.length === 0) return null;
			const filename = `${encodeURIComponent(packageId)}.game.arkpack`;
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
			const signaturePath = `${path}.sig`;
			const signature = yield* fileSystem.exists(signaturePath).pipe(
				Effect.flatMap((exists) =>
					exists
						? fileSystem.stat(signaturePath).pipe(
								Effect.filterOrFail(
									(info) => info.size <= ArkpackLimits.maxSignatureBytes,
									() =>
										new Error(
											`Arkpack signature exceeds the ${ArkpackLimits.maxSignatureBytes} byte limit.`,
										),
								),
								Effect.andThen(fileSystem.readFileString(signaturePath)),
								Effect.map((value) => {
									try {
										return JSON.parse(value) as unknown;
									} catch {
										return value;
									}
								}),
							)
						: Effect.succeed(undefined),
				),
			);
			const file: ArkiniElectronApi.ArkpackFile = {
				packageId,
				filename,
				bytes: Uint8Array.from(bytes),
				...(signature === undefined
					? {}
					: {
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
