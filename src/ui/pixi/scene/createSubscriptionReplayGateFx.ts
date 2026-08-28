import { Effect } from "effect";

type TransitionDelivery = "hydrate" | "present";

export interface SubscriptionReplayGate {
	readonly classifyFx: (sequence: number) => Effect.Effect<TransitionDelivery>;
}

/**
 * Suppresses only the subscription's replay of the snapshot already used to hydrate this scene.
 *
 * A newer first delivery is live and must still be presented; every delivery after the first is
 * live regardless of its sequence.
 */
export const createSubscriptionReplayGateFx = Effect.fn("createSubscriptionReplayGateFx")(
	(hydratedSequence: number) =>
		Effect.sync((): SubscriptionReplayGate => {
			let awaitingInitialReplay = true;

			return {
				classifyFx: Effect.fn("SubscriptionReplayGate.classifyFx")((sequence) =>
					Effect.sync(() => {
						if (!awaitingInitialReplay) return "present";
						awaitingInitialReplay = false;
						return sequence === hydratedSequence ? "hydrate" : "present";
					}),
				),
			};
		}),
);
