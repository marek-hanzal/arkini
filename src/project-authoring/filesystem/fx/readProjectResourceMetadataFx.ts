import { Effect, FileSystem, Option } from "effect";

import { readResourceMetadataFx } from "~/game-config-resource/fx/readResourceMetadataFx";
import type { ProjectResourceSchema } from "~/project-authoring/schema/ProjectResourceSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";
import { readProjectResourceVersionFn } from "../fn/readProjectResourceVersionFn";

/** Reads resource presentation and cache identity without opening or decoding media bodies. */
export const readProjectResourceMetadataFx = Effect.fn("readProjectResourceMetadataFx")(function* (
	resourceUid: string,
	type: ResourceTypeSchema.Type,
	target: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const stat = yield* fileSystem.stat(target);
	if (stat.type !== "File")
		return yield* Effect.fail(new Error(`Editor resource ${target} is not a file.`));
	const size = Number(stat.size);
	return {
		uid: resourceUid,
		type,
		...(yield* readResourceMetadataFx(`${target.slice(0, -4)}.json`)),
		size,
		version: readProjectResourceVersionFn({
			size,
			mtimeMs: Option.getOrUndefined(stat.mtime)?.getTime() ?? 0,
			birthtimeMs: Option.getOrUndefined(stat.birthtime)?.getTime() ?? 0,
			dev: stat.dev,
			ino: Option.getOrUndefined(stat.ino) ?? 0,
		}),
	} satisfies ProjectResourceSchema.Type;
});
