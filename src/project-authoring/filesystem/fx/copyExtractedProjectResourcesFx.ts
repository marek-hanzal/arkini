import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Effect } from "effect";

import type { ExtractedArkpack } from "~/arkpack-admission/type/ExtractedArkpack";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { createProjectPathsFx } from "../createProjectPathsFx";

/** Copies extracted resources into an unpublished managed project one file at a time. */
export const copyExtractedProjectResourcesFx = Effect.fn("copyExtractedProjectResourcesFx")(
	function* ({
		config,
		resources,
		root,
	}: {
		readonly config: GameConfigSchema.Type;
		readonly resources: ExtractedArkpack["resources"];
		readonly root: string;
	}) {
		const paths = yield* createProjectPathsFx(root);
		const shellResources = new Set(Object.values(config.resources));
		for (const resource of resources) {
			const target = yield* shellResources.has(resource.id)
				? paths.resourceFileFx(resource.id)
				: paths.assetFileFx(resource.id);
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
