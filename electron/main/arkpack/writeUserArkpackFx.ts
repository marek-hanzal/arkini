import { randomUUID } from "node:crypto";
import { FileSystem } from "effect";
import { Effect, Exit } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { writeSyncedArkpackFileFx } from "./writeSyncedArkpackFileFx";

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
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			const filename = `${encodeURIComponent(record.packageId)}.arkpack`;
			const output = join(root, filename);
			const temporary = join(root, `.${filename}.${randomUUID()}.pending`);
			const signatureFilename = `${encodeURIComponent(record.packageId)}.arksig`;
			const signatureOutput = join(root, signatureFilename);
			const signatureTemporary = join(root, `.${signatureFilename}.${randomUUID()}.pending`);
			const previous = join(root, `.${filename}.${randomUUID()}.previous`);
			const previousSignature = join(root, `.${signatureFilename}.${randomUUID()}.previous`);
			yield* writeSyncedArkpackFileFx({
				fileSystem,
				path: temporary,
				bytes: record.bytes,
			});
			if (signature !== undefined) {
				yield* writeSyncedArkpackFileFx({
					fileSystem,
					path: signatureTemporary,
					bytes: new TextEncoder().encode(
						`${JSON.stringify(signature, undefined, "\t")}\n`,
					),
				});
			}
			yield* Effect.uninterruptible(
				Effect.gen(function* () {
					const hadPrevious = yield* fileSystem.exists(output);
					const hadPreviousSignature = yield* fileSystem.exists(signatureOutput);
					let movedPrevious = false;
					let movedPreviousSignature = false;
					let published = false;
					let publishedSignature = false;
					const publication = yield* Effect.exit(
						Effect.gen(function* () {
							if (hadPrevious) {
								yield* fileSystem.rename(output, previous);
								movedPrevious = true;
							}
							if (hadPreviousSignature) {
								yield* fileSystem.rename(signatureOutput, previousSignature);
								movedPreviousSignature = true;
							}
							yield* fileSystem.rename(temporary, output);
							published = true;
							if (signature !== undefined) {
								yield* fileSystem.rename(signatureTemporary, signatureOutput);
								publishedSignature = true;
							}
						}),
					);
					if (Exit.isFailure(publication)) {
						if (published)
							yield* fileSystem
								.remove(output, {
									force: true,
								})
								.pipe(Effect.ignore);
						if (publishedSignature)
							yield* fileSystem
								.remove(signatureOutput, {
									force: true,
								})
								.pipe(Effect.ignore);
						if (movedPrevious) {
							yield* fileSystem.rename(previous, output);
						}
						if (movedPreviousSignature) {
							yield* fileSystem.rename(previousSignature, signatureOutput);
						}
						return yield* Effect.failCause(publication.cause);
					}
					yield* fileSystem
						.remove(previous, {
							force: true,
						})
						.pipe(Effect.ignore);
					yield* fileSystem
						.remove(previousSignature, {
							force: true,
						})
						.pipe(Effect.ignore);
				}),
			).pipe(
				Effect.ensuring(
					Effect.all(
						[
							fileSystem.remove(temporary, {
								force: true,
							}),
							fileSystem.remove(signatureTemporary, {
								force: true,
							}),
						],
						{
							discard: true,
						},
					).pipe(Effect.orDie),
				),
			);
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
