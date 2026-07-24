import { FileSystem } from "effect";
import { Effect } from "effect";

import { ArkpackInputError } from "~/engine/pack/error/ArkpackInputError";
import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

/** Reads and validates one explicit trusted-public-key registry JSON file. */
export const readArkpackTrustedKeysFx = Effect.fn("readArkpackTrustedKeysFx")(function* (
	path: string,
) {
	const fileSystem = yield* FileSystem.FileSystem;
	const source = yield* fileSystem.readFileString(path);
	return yield* Effect.try({
		try: () => ArkpackTrustedKeysSchema.parse(JSON.parse(source) as unknown),
		catch: (cause) =>
			new ArkpackInputError({
				operation: "read-trusted-keys",
				message: `Invalid Arkpack trusted-key registry at ${path}.`,
				cause,
			}),
	});
});
