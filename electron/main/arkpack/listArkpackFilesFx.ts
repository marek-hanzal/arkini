import { FileSystem } from "effect";
import { Effect } from "effect";
import { dirname, join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { readArkpackFileFx } from "./readArkpackFileFx";
import { withArkpackFileLockFx } from "./withArkpackFileLockFx";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";

const suffix = ".arkpack";

const decodeGameProjectFileStemFn = (stem: string): string | null => {
	let decoded = "";
	let chunkStart = 0;
	// The encoder reserves invalid UTF-8 surrogate byte sequences only for lone UTF-16 code units.
	for (const match of stem.matchAll(/%ED%([AB][0-9A-F])%([89AB][0-9A-F])/g)) {
		try {
			decoded += decodeURIComponent(stem.slice(chunkStart, match.index));
		} catch {
			return null;
		}
		const second = Number.parseInt(match[1], 16);
		const third = Number.parseInt(match[2], 16);
		decoded += String.fromCharCode(0xd000 | ((second & 0x3f) << 6) | (third & 0x3f));
		chunkStart = match.index + match[0].length;
	}
	try {
		return decoded + decodeURIComponent(stem.slice(chunkStart));
	} catch {
		return null;
	}
};

export namespace listArkpackFilesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly maxCandidates?: number;
		readonly maxTotalBytes?: number;
		readonly source: ArkiniElectronApi.ArkpackFile["source"];
		readonly verifyProvenanceFx?: readArkpackFileFx.Props["verifyProvenanceFx"];
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
		verifyProvenanceFx,
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
				const packageId = decodeGameProjectFileStemFn(entry.slice(0, -suffix.length));
				if (packageId === null) continue;
				if (readArkpackArtifactNameFn(packageId) !== entry) continue;
				if (inspectedCandidates >= maxCandidates) break;
				inspectedCandidates += 1;
				const readCandidateFx = (path: string) =>
					Effect.gen(function* () {
						const candidateRoot = dirname(path);
						const size = Number((yield* fileSystem.stat(path)).size);
						if (totalBytes + size > maxTotalBytes) return null;
						const file = yield* readArkpackFileFx({
							root: candidateRoot,
							fileSystem,
							packageId,
							source,
							verifyProvenanceFx,
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
						? withArkpackFileLockFx(
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
