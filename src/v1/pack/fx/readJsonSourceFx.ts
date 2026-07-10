import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import { GameSourceSchema } from "~/v1/schema/GameSourceSchema";

export namespace readJsonSourceFx {
	export interface Props {
		path: string;
	}
}

export const readJsonSourceFx = Effect.fn("readJsonSourceFx")(function* ({
	path,
}: readJsonSourceFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	const value = yield* Effect.sync(() => GameSourceSchema.parse(JSON.parse(source)));

	return {
		path,
		value,
	} as const;
});
