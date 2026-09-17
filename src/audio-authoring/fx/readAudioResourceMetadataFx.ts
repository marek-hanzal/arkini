import { Effect, FileSystem } from "effect";

import { AudioResourceMetadataSchema } from "../schema/AudioResourceMetadataSchema";

/** Reads the required Editor-only audio name without opening the audio body. */
export const readAudioResourceMetadataFx = Effect.fn("readAudioResourceMetadataFx")(function* (
	path: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	return yield* Effect.try({
		try: () => AudioResourceMetadataSchema.parse(JSON.parse(source)),
		catch: (cause) =>
			new Error(`Audio metadata ${path} is invalid.`, {
				cause,
			}),
	});
});
