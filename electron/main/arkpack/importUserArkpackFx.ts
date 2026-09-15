import { randomUUID } from "node:crypto";
import { copyFile, open } from "node:fs/promises";
import { join } from "node:path";
import { Effect, type FileSystem } from "effect";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { extractArkpackFileFx } from "~/arkpack-admission/fx/extractArkpackFileFx";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { withArkpackFileLockFx } from "./withArkpackFileLockFx";

export namespace importUserArkpackFx {
	export interface Props {
		readonly fileSystem: FileSystem.FileSystem;
		readonly sourcePath: string;
		readonly stagingRoot: string;
		readonly userRoot: string;
	}
}

/** Stream-validates and atomically copies one selected Arkpack into the user catalog. */
export const importUserArkpackFx = Effect.fn("importUserArkpackFx")(function* ({
	fileSystem,
	sourcePath,
	stagingRoot,
	userRoot,
}: importUserArkpackFx.Props) {
	yield* fileSystem.makeDirectory(stagingRoot, {
		recursive: true,
	});
	const importId = randomUUID();
	const stagedArkpack = join(stagingRoot, `.import-${importId}.arkpack`);
	const extractionRoot = join(stagingRoot, `.import-${importId}`);
	return yield* Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: async () => {
				await copyFile(sourcePath, stagedArkpack);
				const file = await open(stagedArkpack, "r");
				try {
					await file.sync();
				} finally {
					await file.close();
				}
			},
			catch: (cause) => cause,
		});
		const extracted = yield* extractArkpackFileFx({
			arkpackPath: stagedArkpack,
			outputRoot: extractionRoot,
		});
		const target = join(userRoot, readArkpackArtifactNameFn(extracted.packageId));
		yield* fileSystem.makeDirectory(userRoot, {
			recursive: true,
		});
		yield* withArkpackFileLockFx(
			{
				arkpackPath: target,
				fileSystem,
			},
			(lockedTarget) => fileSystem.rename(stagedArkpack, lockedTarget),
		);
		return {
			packageId: extracted.packageId,
			filename: readArkpackArtifactNameFn(extracted.packageId),
			contentHash: extracted.contentHash,
			title: extracted.config.meta.title,
			version: extracted.version,
			arkini: extracted.arkini,
			provenance: extracted.provenance,
			source: "user",
			overridesBundled: false,
		} satisfies ArkiniElectronApi.ArkpackFile;
	}).pipe(
		Effect.ensuring(
			Effect.all(
				[
					fileSystem.remove(stagedArkpack, {
						force: true,
					}),
					fileSystem.remove(extractionRoot, {
						force: true,
						recursive: true,
					}),
				],
				{
					discard: true,
				},
			).pipe(Effect.ignore),
		),
	);
});
