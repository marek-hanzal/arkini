import { Effect } from "effect";

import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";

/** Reads the latest exact sequenced committed runtime transition. */
export const readCommittedTransitionFx = Effect.fn("readCommittedTransitionFx")(function* () {
	const transitions = yield* CommittedTransitionsFx;
	return yield* transitions.read;
});
