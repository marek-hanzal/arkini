import { Effect } from "effect";

type PixiMainSceneTransitionDelivery = "hydrate" | "present";

export interface PixiMainSceneSubscriptionReplayGate {
	readonly classifyFx: (sequence: number) => Effect.Effect<PixiMainSceneTransitionDelivery>;
}

/**
 * Suppresses only the subscription's replay of the snapshot already used to hydrate this scene.
 *
 * A newer first delivery is live and must still be presented; every delivery after the first is
 * live regardless of its sequence.
 */
export const createSubscriptionReplayGateFx = Effect.fn("createSubscriptionReplayGateFx")(
	(hydratedSequence: number) =>
		Effect.sync((): PixiMainSceneSubscriptionReplayGate => {
			let awaitingInitialReplay = true;

			return {
				classifyFx: Effect.fn("PixiMainSceneSubscriptionReplayGate.classifyFx")(
					(sequence) =>
						Effect.sync(() => {
							if (!awaitingInitialReplay) return "present";
							awaitingInitialReplay = false;
							return sequence === hydratedSequence ? "hydrate" : "present";
						}),
				),
			};
		}),
);
