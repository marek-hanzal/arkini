import { FileSystem } from "effect";
import { Effect } from "effect";
import { dirname, join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { readArkpackFileFx } from "./readArkpackFileFx";
import {
	recoverArkpackArtifactPairFx,
	withRecoveredArkpackArtifactPairFx,
} from "./recoverArkpackArtifactPairFx";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

const suffix = ".arkpack";

export namespace listArkpackFilesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly maxCandidates?: number;
		readonly maxTotalBytes?: number;
		readonly source: ArkiniElectronApi.ArkpackFile["source"];
		readonly verifyTrustFx?: readArkpackFileFx.Props["verifyTrustFx"];
	}
}

/** Scans one well-known root without interpreting package payload semantics. */
export const listArkpackFilesFx = Effect.fn("listArkpackFilesFx")(
	({
		root,
		fileSystem,
		maxCandidates = ArkpackLimits.maxCatalogCandidates / 2,
		maxTotalBytes = ArkpackLimits.maxCatalogBytes / 2,
		source,
		verifyTrustFx,
	}: listArkpackFilesFx.Props) =>
		Effect.gen(function* () {
			if (source === "user") {
				yield* fileSystem.makeDirectory(root, {
					recursive: true,
				});
			} else if (!(yield* fileSystem.exists(root))) {
				return [];
			}
			if (source === "user") {
				const transactionSuffix = `${suffix}.transaction`;
				const cleanupSuffix = `${transactionSuffix}.cleanup`;
				for (const entry of yield* fileSystem.readDirectory(root)) {
					if (
						!entry.startsWith(".") ||
						(!entry.endsWith(transactionSuffix) && !entry.endsWith(cleanupSuffix))
					)
						continue;
					const journalSuffix = entry.endsWith(cleanupSuffix)
						? ".transaction.cleanup"
						: ".transaction";
					const arkpackEntry = entry.slice(1, -journalSuffix.length);
					let packageId: string;
					try {
						packageId = decodeURIComponent(arkpackEntry.slice(0, -suffix.length));
					} catch {
						continue;
					}
					if (`${encodeGameProjectFileStem(packageId)}${suffix}` !== arkpackEntry)
						continue;
					yield* recoverArkpackArtifactPairFx({
						arkpackPath: join(root, arkpackEntry),
						fileSystem,
					});
				}
			}
			const entries = (yield* fileSystem.readDirectory(root))
				.filter((entry) => entry.endsWith(suffix))
				.sort();
			const files: ArkiniElectronApi.ArkpackFile[] = [];
			let inspectedCandidates = 0;
			let totalBytes = 0;
			for (const entry of entries) {
				let packageId: string;
				try {
					packageId = decodeURIComponent(entry.slice(0, -suffix.length));
				} catch {
					continue;
				}
				if (`${encodeGameProjectFileStem(packageId)}${suffix}` !== entry) continue;
				if (inspectedCandidates >= maxCandidates) break;
				inspectedCandidates += 1;
				const readCandidateFx = (path: string) =>
					Effect.gen(function* () {
						const candidateRoot = dirname(path);
						const signaturePath = join(
							candidateRoot,
							`${entry.slice(0, -suffix.length)}.arksig`,
						);
						const signatureSize = yield* fileSystem.exists(signaturePath).pipe(
							Effect.flatMap((exists) =>
								exists
									? fileSystem
											.stat(signaturePath)
											.pipe(
												Effect.map((info) =>
													info.size <= ArkpackLimits.maxSignatureBytes
														? Number(info.size)
														: 0,
												),
											)
									: Effect.succeed(0),
							),
							Effect.catch(() => Effect.succeed(0)),
						);
						const size = Number((yield* fileSystem.stat(path)).size) + signatureSize;
						if (totalBytes + size > maxTotalBytes) return null;
						const file = yield* readArkpackFileFx({
							root: candidateRoot,
							fileSystem,
							packageId,
							source,
							verifyTrustFx,
						});
						return file === null
							? null
							: {
									file,
									size,
								};
					});
				const requestedPath = join(root, entry);
				const file = yield* (
					source === "user"
						? withRecoveredArkpackArtifactPairFx(
								{
									arkpackPath: requestedPath,
									fileSystem,
								},
								readCandidateFx,
							)
						: readCandidateFx(requestedPath)
				).pipe(
					Effect.match({
						onFailure: () => null,
						onSuccess: (admitted) => admitted,
					}),
				);
				if (file !== null) {
					files.push(file.file);
					totalBytes += file.size;
				}
			}
			return files;
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: `list ${source} Arkpacks`,
						cause,
					}),
			),
		),
);
