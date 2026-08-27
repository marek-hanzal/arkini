import { dirname, join } from "node:path";
import { FileSystem } from "effect";
import { Effect, Exit } from "effect";

import { readArkpackSignaturePathFx } from "~/engine/pack/fx/readArkpackSignaturePathFx";
import type { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { syncFilesystemPathFx } from "../filesystem/syncFilesystemPathFx";
import { withFilesystemLockFx } from "../filesystem/withFilesystemLockFx";
import {
	finalizeArkpackArtifactPairTransactionFx,
	readArkpackArtifactPairPaths,
	readCanonicalArkpackPathFx,
	recoverArkpackArtifactPairUnlockedFx,
} from "./recoverArkpackArtifactPairFx";
import { writeSyncedArkpackFileFx } from "./writeSyncedArkpackFileFx";

/** Publishes an Arkpack and its optional detached signature as one recoverable pair. */
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
			const requestedRoot = dirname(arkpackPath);
			yield* fileSystem.makeDirectory(requestedRoot, {
				recursive: true,
			});
			const canonicalArkpackPath = yield* readCanonicalArkpackPathFx(fileSystem, arkpackPath);
			const signaturePath = yield* readArkpackSignaturePathFx(canonicalArkpackPath);
			const paths = readArkpackArtifactPairPaths(canonicalArkpackPath);
			return yield* withFilesystemLockFx(
				paths.lock,
				Effect.gen(function* () {
					yield* recoverArkpackArtifactPairUnlockedFx({
						arkpackPath: canonicalArkpackPath,
						fileSystem,
					});
					yield* fileSystem.makeDirectory(paths.transaction);
					yield* syncFilesystemPathFx(fileSystem, paths.root);

					const publication = Effect.gen(function* () {
						yield* writeSyncedArkpackFileFx({
							fileSystem,
							path: paths.pendingArkpack,
							bytes,
						});
						if (signature !== undefined)
							yield* writeSyncedArkpackFileFx({
								fileSystem,
								path: paths.pendingSignature,
								bytes: new TextEncoder().encode(`${signature}\n`),
							});

						const hadArkpack = yield* fileSystem.exists(canonicalArkpackPath);
						const hadSignature = yield* fileSystem.exists(signaturePath);
						if (hadArkpack) {
							yield* fileSystem.copy(canonicalArkpackPath, paths.previousArkpack, {
								overwrite: false,
							});
							yield* syncFilesystemPathFx(fileSystem, paths.previousArkpack);
							yield* writeSyncedArkpackFileFx({
								fileSystem,
								path: join(paths.transaction, "had-arkpack"),
								bytes: Uint8Array.of(1),
							});
						}
						if (hadSignature) {
							yield* fileSystem.copy(signaturePath, paths.previousSignature, {
								overwrite: false,
							});
							yield* syncFilesystemPathFx(fileSystem, paths.previousSignature);
							yield* writeSyncedArkpackFileFx({
								fileSystem,
								path: join(paths.transaction, "had-signature"),
								bytes: Uint8Array.of(1),
							});
						}
						yield* writeSyncedArkpackFileFx({
							fileSystem,
							path: join(paths.transaction, "ready"),
							bytes: Uint8Array.of(1),
						});
						yield* syncFilesystemPathFx(fileSystem, paths.transaction);
						yield* syncFilesystemPathFx(fileSystem, paths.root);

						if (signature !== undefined) {
							yield* fileSystem.rename(paths.pendingSignature, signaturePath);
							yield* fileSystem.rename(paths.pendingArkpack, canonicalArkpackPath);
						} else {
							yield* fileSystem.rename(paths.pendingArkpack, canonicalArkpackPath);
							yield* fileSystem.remove(signaturePath, {
								force: true,
							});
						}
						yield* syncFilesystemPathFx(fileSystem, paths.root);
						yield* writeSyncedArkpackFileFx({
							fileSystem,
							path: join(paths.transaction, "committed"),
							bytes: Uint8Array.of(1),
						});
						yield* syncFilesystemPathFx(fileSystem, paths.transaction);
					});

					const result = yield* Effect.exit(Effect.uninterruptible(publication));
					if (Exit.isFailure(result)) {
						yield* recoverArkpackArtifactPairUnlockedFx({
							arkpackPath: canonicalArkpackPath,
							fileSystem,
						});
						return yield* Effect.failCause(result.cause);
					}
					yield* finalizeArkpackArtifactPairTransactionFx({
						arkpackPath: canonicalArkpackPath,
						fileSystem,
					}).pipe(Effect.ignore);
				}),
			);
		}),
);
