import { FileSystem } from "effect";
import { Effect } from "effect";
import { dirname, join } from "node:path";
import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { SerapackLimits } from "~shared/SerapackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { readSerapackFileFx } from "./readSerapackFileFx";
import { withSerapackFileLockFx } from "./withSerapackFileLockFx";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";

const suffix = ".serapack";

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

export namespace listSerapackFilesFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly maxCandidates?: number;
		readonly maxTotalBytes?: number;
		readonly source: SerakkiElectronApi.SerapackFile["source"];
		readonly verifyProvenanceFx?: readSerapackFileFx.Props["verifyProvenanceFx"];
	}
}

/** Scans one well-known root without interpreting package payload semantics. */
export const listSerapackFilesFx = Effect.fn("listSerapackFilesFx")(
	({
		root,
		fileSystem,
		maxCandidates = SerapackLimits.maxCatalogCandidates / 2,
		maxTotalBytes = SerapackLimits.maxCatalogBytes / 2,
		source,
		verifyProvenanceFx,
	}: listSerapackFilesFx.Props) =>
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
			const files: SerakkiElectronApi.SerapackFile[] = [];
			let inspectedCandidates = 0;
			let totalBytes = 0;
			for (const entry of entries) {
				const packageId = decodeGameProjectFileStemFn(entry.slice(0, -suffix.length));
				if (packageId === null) continue;
				if (readSerapackArtifactNameFn(packageId) !== entry) continue;
				if (inspectedCandidates >= maxCandidates) break;
				inspectedCandidates += 1;
				const readCandidateFx = (path: string) =>
					Effect.gen(function* () {
						const candidateRoot = dirname(path);
						const size = Number((yield* fileSystem.stat(path)).size);
						if (totalBytes + size > maxTotalBytes) return null;
						const file = yield* readSerapackFileFx({
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
						? withSerapackFileLockFx(
								{
									serapackPath: requestedPath,
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
						operation: `list ${source} Serapacks`,
						cause,
					}),
			),
		),
);
