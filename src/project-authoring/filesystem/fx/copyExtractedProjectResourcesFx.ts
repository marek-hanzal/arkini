import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Effect } from "effect";

import type { ExtractedArkpack } from "~/arkpack-admission/type/ExtractedArkpack";
import { createProjectPathsFx } from "../createProjectPathsFx";
import { readInitialAudioResourceNameFn } from "~/audio-authoring/fn/readInitialAudioResourceNameFn";
import { AudioResourceMetadataSchema } from "~/audio-authoring/schema/AudioResourceMetadataSchema";

/** Copies extracted resources into an unpublished managed project one file at a time. */
export const copyExtractedProjectResourcesFx = Effect.fn("copyExtractedProjectResourcesFx")(
	function* ({
		resources,
		root,
	}: {
		readonly resources: ExtractedArkpack["resources"];
		readonly root: string;
	}) {
		const paths = yield* createProjectPathsFx(root);
		for (const resource of resources) {
			const target = yield* paths.resourceFileFx(resource);
			const metadataTarget =
				resource.type === "music" || resource.type === "sfx"
					? yield* paths.audioMetadataFileFx({
							id: resource.id,
							type: resource.type,
						})
					: undefined;
			const metadata =
				metadataTarget === undefined
					? undefined
					: AudioResourceMetadataSchema.parse({
							name: readInitialAudioResourceNameFn(resource.id),
						});
			yield* Effect.tryPromise({
				try: async () => {
					await mkdir(dirname(target), {
						recursive: true,
					});
					await copyFile(resource.path, target, constants.COPYFILE_EXCL);
					// Arkpacks intentionally carry no Editor names; import creates fresh metadata.
					if (metadataTarget !== undefined)
						await writeFile(
							metadataTarget,
							`${JSON.stringify(metadata, undefined, "\t")}\n`,
							{
								flag: "wx",
							},
						);
				},
				catch: (cause) => cause,
			});
		}
	},
);
