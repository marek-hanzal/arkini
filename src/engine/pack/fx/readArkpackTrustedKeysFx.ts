import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

/** Reads and validates one explicit trusted-public-key registry JSON file. */
export const readArkpackTrustedKeysFx = Effect.fn("readArkpackTrustedKeysFx")(function* (
	path: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	return yield* Effect.sync(() => ArkpackTrustedKeysSchema.parse(JSON.parse(source) as unknown));
});
