import { NodeContext } from "@effect/platform-node";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";

import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";

const ArkiniDirectory = fileURLToPath(new URL("../../../game/arkini/", import.meta.url));

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
