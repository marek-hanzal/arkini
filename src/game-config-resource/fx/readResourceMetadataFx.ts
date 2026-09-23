import { Effect, FileSystem } from "effect";

import { ResourceMetadataSchema } from "../schema/ResourceMetadataSchema";

/** Reads the required Editor-only resource title without opening the audio body. */
export const readResourceMetadataFx = Effect.fn("readResourceMetadataFx")(function* (path: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	return yield* Effect.try({
		try: () => ResourceMetadataSchema.parse(JSON.parse(source)),
		catch: (cause) =>
			new Error(`Resource metadata ${path} is invalid.`, {
				cause,
			}),
	});
});
