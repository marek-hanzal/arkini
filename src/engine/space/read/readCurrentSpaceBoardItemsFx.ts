import { Array, Effect } from "effect";

import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";

/** Reads the board items currently presented to the player. */
export const readCurrentSpaceBoardItemsFx = Effect.fn("readCurrentSpaceBoardItemsFx")(function* () {
	const runtimeFx = yield* RuntimeFx;
	const runtime = yield* runtimeFx.read;
	const boardItems = Array.getSomes(yield* Effect.forEach(runtime.items, isBoardRuntimeItemFx));

	return boardItems.filter((item) => item.location.space === runtime.currentSpace);
});
