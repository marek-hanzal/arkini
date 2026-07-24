import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

export namespace readArkpackPrivateKeyFx {
	export interface Props {
		readonly environmentValue?: string;
		readonly path?: string;
	}
}

/** Resolves an explicit PKCS8 private key from environment content or one tooling path. */
export const readArkpackPrivateKeyFx = Effect.fn("readArkpackPrivateKeyFx")(function* ({
	environmentValue,
	path,
}: readArkpackPrivateKeyFx.Props) {
	if (environmentValue !== undefined && environmentValue.trim().length > 0) {
		return environmentValue;
	}
	if (path === undefined || path.trim().length === 0) {
		return yield* Effect.fail(
			new Error(
				"An Arkpack private key must be supplied through the environment or an explicit path.",
			),
		);
	}
	const fileSystem = yield* FileSystem.FileSystem;
	return yield* fileSystem.readFileString(path);
});
