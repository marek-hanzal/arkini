import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import { GameSourceFileSchema } from "~/v1/source/schema/GameSourceFileSchema";
import { GameSourceSchema } from "~/v1/schema/GameSourceSchema";

export namespace readGameSourceFileFx {
	export interface Props {
		path: string;
	}
}

/** Parses one JSON authoring fragment together with its source path. */
export const readGameSourceFileFx = Effect.fn("readGameSourceFileFx")(function* ({
	path,
}: readGameSourceFileFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	const value = yield* Effect.sync(() => GameSourceSchema.parse(JSON.parse(source)));

	return {
		path,
		value,
	} satisfies GameSourceFileSchema.Type;
});
