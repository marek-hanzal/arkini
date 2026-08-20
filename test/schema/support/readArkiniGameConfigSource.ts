import * as NodeServices from "@effect/platform-node/NodeServices";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";

import { compileGameDirectoryFx } from "~/engine/compiler/fx/compileGameDirectoryFx";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";

const ArkiniDirectory = fileURLToPath(new URL("../../../game/arkini/", import.meta.url));
const DemoDirectory = fileURLToPath(new URL("../../../game/demo/", import.meta.url));

const readGameConfigSource = (input: string) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const result = yield* compileGameDirectoryFx({
				input,
			});

			return yield* assertGameConfigValidFx(result);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

/** Reads the current Arkini authoring directory through the production completed-game compiler. */
export const readArkiniGameConfigSource = () => readGameConfigSource(ArkiniDirectory);

/** Reads the current demo authoring directory through the production completed-game compiler. */
export const readDemoGameConfigSource = () => readGameConfigSource(DemoDirectory);
