import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";

import { compileGameDirectoryFx } from "~/v1/compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/v1/validation/fx/assertGameConfigValidFx";

const ArkiniDirectory = new URL("../../../game/arkini/", import.meta.url).pathname;

/** Reads the current authoring directory through the production completed-game compiler. */
export const readArkiniGameConfigSource = () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const result = yield* compileGameDirectoryFx({
				input: ArkiniDirectory,
			});

			return yield* assertGameConfigValidFx(result);
		}).pipe(Effect.provide(NodeContext.layer)),
	);
