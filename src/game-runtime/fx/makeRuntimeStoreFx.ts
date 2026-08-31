import { Effect, Option, SubscriptionRef } from "effect";

import type { RuntimeStoreFxService } from "~/game-runtime/context/RuntimeStoreFx";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";

/** Builds the one authoritative, replaying committed-transition reference. */
export const makeRuntimeStoreFx = Effect.fn("makeRuntimeStoreFx")(function* (
	initial: CommittedTransitionSchema.Type,
) {
	const ref = yield* SubscriptionRef.make(initial);
	const modifyEffect: RuntimeStoreFxService["modifyEffect"] = (update) =>
		SubscriptionRef.modifySomeEffect(ref, (transition) =>
			update(transition).pipe(
				Effect.map(([result, nextTransition]) => [
					result,
					nextTransition === transition ? Option.none() : Option.some(nextTransition),
				]),
			),
		);

	return {
		ref,
		read: SubscriptionRef.get(ref),
		readUnsafe: () => SubscriptionRef.getUnsafe(ref),
		changes: SubscriptionRef.changes(ref),
		modifyEffect,
	} satisfies RuntimeStoreFxService;
});
