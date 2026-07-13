import { Context, type Stream } from "effect";

import type { CommittedTransitionSchema } from "~/v1/runtime/schema/CommittedTransitionSchema";

export interface CommittedTransitionsFxService {
	/** Emits the current committed transition and every subsequent successful commit. */
	readonly changes: Stream.Stream<CommittedTransitionSchema.Type>;
}

/** Read-only stream of atomically committed runtime transitions. */
export class CommittedTransitionsFx extends Context.Tag("CommittedTransitionsFx")<
	CommittedTransitionsFx,
	CommittedTransitionsFxService
>() {
	//
}
