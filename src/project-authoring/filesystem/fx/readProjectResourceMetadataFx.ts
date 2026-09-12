import { Effect, FileSystem, Option } from "effect";

import type { ProjectResourceSchema } from "~/project-authoring/schema/ProjectResourceSchema";
import { readProjectResourceVersionFn } from "../fn/readProjectResourceVersionFn";

/** Reads a resource's cache identity without opening or decoding its PNG body. */
export const readProjectResourceMetadataFx = Effect.fn("readProjectResourceMetadataFx")(function* (
	resourceId: string,
	target: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const stat = yield* fileSystem.stat(target);
	if (stat.type !== "File")
		return yield* Effect.fail(new Error(`Editor asset ${target} is not a file.`));
	const size = Number(stat.size);
	return {
		id: resourceId,
		mime: "image/png",
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
