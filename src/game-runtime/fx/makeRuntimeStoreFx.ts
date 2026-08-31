import { Effect, Option, SubscriptionRef } from "effect";

import type { RuntimeStoreFxService } from "~/game-runtime/context/RuntimeStoreFx";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";

/** Builds the one authoritative, replaying committed-transition reference. */
export const makeRuntimeStoreFx = Effect.fn("makeRuntimeStoreFx")(function* (
	initial: CommittedTransitionSchema.Type,
) {
	const ref = yield* SubscriptionRef.make(initial);
	const modifyEffectFx: RuntimeStoreFxService["modifyEffectFx"] = (updateFx) =>
		SubscriptionRef.modifySomeEffect(ref, (transition) =>
			updateFx(transition).pipe(
				Effect.map(([result, nextTransition]) => [
					result,
					nextTransition === transition ? Option.none() : Option.some(nextTransition),
				]),
			),
		);

	return {
		ref,
		read: SubscriptionRef.get(ref),
		readUnsafeFn: () => SubscriptionRef.getUnsafe(ref),
		changes: SubscriptionRef.changes(ref),
		modifyEffectFx,
	} satisfies RuntimeStoreFxService;
});
