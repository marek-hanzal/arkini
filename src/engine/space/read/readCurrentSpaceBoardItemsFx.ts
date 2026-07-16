import { Effect } from "effect";

import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";

/** Reads the board items currently presented to the player. */
export const readCurrentSpaceBoardItemsFx = Effect.fn("readCurrentSpaceBoardItemsFx")(function* () {
	const runtimeFx = yield* RuntimeFx;
	const runtime = yield* runtimeFx.read;

	return runtime.items
		.filter(isBoardRuntimeItem)
		.filter((item) => item.location.space === runtime.currentSpace);
});
