import { Effect } from "effect";

import { CommittedTransitionsFx } from "~/engine/runtime/context/CommittedTransitionsFx";

/** Reads the latest exact sequenced committed runtime transition. */
export const readCommittedTransitionFx = () =>
	CommittedTransitionsFx.pipe(Effect.flatMap((transitions) => transitions.read));
