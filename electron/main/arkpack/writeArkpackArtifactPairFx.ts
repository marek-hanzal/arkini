import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { FileSystem } from "effect";
import { Effect, Exit } from "effect";

import type { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { readArkpackSignaturePathFx } from "~/engine/pack/fx/readArkpackSignaturePathFx";
import { writeSyncedArkpackFileFx } from "./writeSyncedArkpackFileFx";

/** Publishes an Arkpack and its optional detached signature as one rollback-safe pair. */
export const writeArkpackArtifactPairFx = Effect.fn("writeArkpackArtifactPairFx")(
	({
		arkpackPath,
		bytes,
		fileSystem,
		signature,
	}: {
		readonly arkpackPath: string;
		readonly bytes: Uint8Array;
		readonly fileSystem: FileSystem.FileSystem;
		readonly signature?: ArkpackSignatureSchema.Type;
	}) =>
		Effect.gen(function* () {
			const root = dirname(arkpackPath);
			const signaturePath = yield* readArkpackSignaturePathFx(arkpackPath);
			const pendingArkpack = join(root, `.${basename(arkpackPath)}.${randomUUID()}.pending`);
			const pendingSignature = join(
				root,
				`.${basename(signaturePath)}.${randomUUID()}.pending`,
			);
			const previousArkpack = join(
				root,
				`.${basename(arkpackPath)}.${randomUUID()}.previous`,
			);
			const previousSignature = join(
				root,
				`.${basename(signaturePath)}.${randomUUID()}.previous`,
			);
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			yield* Effect.gen(function* () {
				yield* writeSyncedArkpackFileFx({
					fileSystem,
					path: pendingArkpack,
					bytes,
				});
				if (signature !== undefined) {
					yield* writeSyncedArkpackFileFx({
						fileSystem,
						path: pendingSignature,
						bytes: new TextEncoder().encode(`${signature}\n`),
					});
				}

				yield* Effect.uninterruptible(
					Effect.gen(function* () {
						const hadArkpack = yield* fileSystem.exists(arkpackPath);
						const hadSignature = yield* fileSystem.exists(signaturePath);
						let movedArkpack = false;
						let movedSignature = false;
						let publishedArkpack = false;
						let publishedSignature = false;
						const publication = yield* Effect.exit(
							Effect.gen(function* () {
								if (hadArkpack) {
									yield* fileSystem.rename(arkpackPath, previousArkpack);
									movedArkpack = true;
								}
								if (hadSignature) {
									yield* fileSystem.rename(signaturePath, previousSignature);
									movedSignature = true;
								}
								yield* fileSystem.rename(pendingArkpack, arkpackPath);
								publishedArkpack = true;
								if (signature !== undefined) {
									yield* fileSystem.rename(pendingSignature, signaturePath);
									publishedSignature = true;
								}
							}),
						);
						if (Exit.isFailure(publication)) {
							if (publishedArkpack)
								yield* fileSystem
									.remove(arkpackPath, {
										force: true,
									})
									.pipe(Effect.ignore);
							if (publishedSignature)
								yield* fileSystem
									.remove(signaturePath, {
										force: true,
									})
									.pipe(Effect.ignore);
							if (movedArkpack)
								yield* fileSystem.rename(previousArkpack, arkpackPath);
							if (movedSignature)
								yield* fileSystem.rename(previousSignature, signaturePath);
							return yield* Effect.failCause(publication.cause);
						}
						yield* fileSystem
							.remove(previousArkpack, {
								force: true,
							})
							.pipe(Effect.ignore);
						yield* fileSystem
							.remove(previousSignature, {
								force: true,
							})
							.pipe(Effect.ignore);
					}),
				);
			}).pipe(
				Effect.ensuring(
					Effect.all(
						[
							fileSystem.remove(pendingArkpack, {
								force: true,
							}),
							fileSystem.remove(pendingSignature, {
								force: true,
							}),
						],
						{
							discard: true,
						},
					).pipe(Effect.orDie),
				),
			);
		}),
);
