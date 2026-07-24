import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import { ArkpackInputError } from "~/engine/pack/error/ArkpackInputError";

export namespace readArkpackPrivateKeyFx {
	export interface Props {
		readonly privateKey?: string;
		readonly path?: string;
	}
}

/** Resolves an explicit PKCS8 private key from environment content or one tooling path. */
export const readArkpackPrivateKeyFx = Effect.fn("readArkpackPrivateKeyFx")(function* ({
	privateKey,
	path,
}: readArkpackPrivateKeyFx.Props) {
	if (privateKey !== undefined && privateKey.trim().length > 0) {
		return privateKey;
	}
	if (path === undefined || path.trim().length === 0) {
		return yield* Effect.fail(
			new ArkpackInputError({
				operation: "read-private-key",
				message:
					"An Arkpack private key must be supplied through the environment or an explicit path.",
				cause: {
					path,
				},
			}),
		);
	}
	const fileSystem = yield* FileSystem.FileSystem;
	return yield* fileSystem.readFileString(path);
});
