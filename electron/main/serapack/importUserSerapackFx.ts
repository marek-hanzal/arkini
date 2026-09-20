import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Effect, type FileSystem } from "effect";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { extractSerapackFileFx } from "~/serapack-admission/fx/extractSerapackFileFx";
import { readSerapackArtifactNameFn } from "~/serapack-artifact/fn/readSerapackArtifactNameFn";
import { withSerapackFileLockFx } from "./withSerapackFileLockFx";

export namespace importUserSerapackFx {
	export interface Props {
		readonly fileSystem: FileSystem.FileSystem;
		readonly sourcePath: string;
		readonly stagingRoot: string;
		readonly userRoot: string;
	}
}

/** Stream-validates and copies one selected Serapack into the user catalog. */
export const importUserSerapackFx = Effect.fn("importUserSerapackFx")(function* ({
	fileSystem,
	sourcePath,
	stagingRoot,
	userRoot,
}: importUserSerapackFx.Props) {
	yield* fileSystem.makeDirectory(stagingRoot, {
		recursive: true,
	});
	const importId = randomUUID();
	const extractionRoot = join(stagingRoot, `.import-${importId}`);
	return yield* Effect.gen(function* () {
		const extracted = yield* extractSerapackFileFx({
			serapackPath: sourcePath,
			outputRoot: extractionRoot,
		});
		const target = join(userRoot, readSerapackArtifactNameFn(extracted.packageId));
		yield* fileSystem.makeDirectory(userRoot, {
			recursive: true,
		});
		yield* withSerapackFileLockFx(
			{
				serapackPath: target,
				fileSystem,
			},
			(lockedTarget) => fileSystem.copyFile(sourcePath, lockedTarget),
		);
		return {
			packageId: extracted.packageId,
			filename: readSerapackArtifactNameFn(extracted.packageId),
			contentHash: extracted.contentHash,
			title: extracted.config.meta.title,
			version: extracted.version,
			serakki: extracted.serakki,
			provenance: extracted.provenance,
			source: "user",
			overridesBundled: false,
		} satisfies SerakkiElectronApi.SerapackFile;
	}).pipe(
		Effect.ensuring(
			fileSystem
				.remove(extractionRoot, {
					force: true,
					recursive: true,
				})
				.pipe(Effect.ignore),
		),
	);
});
