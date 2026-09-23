import { constants } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Effect } from "effect";

import type { ExtractedSerapack } from "~/serapack-admission/type/ExtractedSerapack";
import { createProjectPathsFx } from "../createProjectPathsFx";
import { ResourceMetadataSchema } from "~/game-config-resource/schema/ResourceMetadataSchema";

/** Copies extracted resources into an unpublished managed project one file at a time. */
export const copyExtractedProjectResourcesFx = Effect.fn("copyExtractedProjectResourcesFx")(
	function* ({
		resources,
		root,
	}: {
		readonly resources: ExtractedSerapack["resources"];
		readonly root: string;
	}) {
		const paths = yield* createProjectPathsFx(root);
		for (const resource of resources) {
			const target = yield* paths.resourceFileFx(resource);
			const metadataTarget = yield* paths.resourceMetadataFileFx(resource);
			const metadata = ResourceMetadataSchema.parse({
				title: resource.uid,
			});
			yield* Effect.tryPromise({
				try: async () => {
					await mkdir(dirname(target), {
						recursive: true,
					});
					await copyFile(resource.path, target, constants.COPYFILE_EXCL);
					// Serapacks intentionally carry no Editor names; import creates fresh metadata.
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
