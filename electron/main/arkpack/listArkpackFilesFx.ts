import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { readArkpackFileFx } from "./readArkpackFileFx";

const suffix = ".arkpack";

export namespace listArkpackFilesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly maxCandidates?: number;
		readonly maxTotalBytes?: number;
		readonly source: ArkiniElectronApi.ArkpackFile["source"];
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
	}: listArkpackFilesFx.Props) =>
		Effect.gen(function* () {
			if (source === "user") {
				yield* fileSystem.makeDirectory(root, {
					recursive: true,
				});
			} else if (!(yield* fileSystem.exists(root))) {
				return [];
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
				if (`${encodeURIComponent(packageId)}${suffix}` !== entry) continue;
				if (inspectedCandidates >= maxCandidates) break;
				inspectedCandidates += 1;
				const file = yield* Effect.gen(function* () {
					const path = join(root, entry);
					const signaturePath = join(root, `${entry.slice(0, -suffix.length)}.arksig`);
					const size =
						Number((yield* fileSystem.stat(path)).size) +
						((yield* fileSystem.exists(signaturePath))
							? Number((yield* fileSystem.stat(signaturePath)).size)
							: 0);
					if (totalBytes + size > maxTotalBytes) return null;
					const file = yield* readArkpackFileFx({
						root,
						fileSystem,
						packageId,
						source,
					});
					return file === null
						? null
						: {
								file,
								size,
							};
				}).pipe(
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
