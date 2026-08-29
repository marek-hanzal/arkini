import { Array, Effect } from "effect";

import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";

/** Reads the board items currently presented to the player. */
export const readCurrentSpaceBoardItemsFx = Effect.fn("readCurrentSpaceBoardItemsFx")(function* () {
	const runtimeFx = yield* RuntimeFx;
	const runtime = yield* runtimeFx.read;
	const boardItems = Array.getSomes(runtime.items.map(isBoardRuntimeItemFn));

	return boardItems.filter((item) => item.location.space === runtime.currentSpace);
});
