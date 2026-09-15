import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Effect } from "effect";

import type { ExtractedArkpack } from "~/arkpack-admission/type/ExtractedArkpack";
import { createProjectPathsFx } from "../createProjectPathsFx";

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
			const target = yield* resource.type === "image"
				? paths.imageFileFx(resource.id)
				: paths.artworkFileFx(resource.id);
			yield* Effect.tryPromise({
				try: async () => {
					await mkdir(dirname(target), {
						recursive: true,
					});
					await copyFile(resource.path, target, constants.COPYFILE_EXCL);
				},
				catch: (cause) => cause,
			});
		}
	},
);
