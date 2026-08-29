import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { GameSession } from "~/renderer/game/session/GameSession";
import { GameSessionFatalError } from "~/renderer/game/session/GameSessionFatalError";
import type { CommittedTransitionSchema } from "~/game-runtime/schema/CommittedTransitionSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

type TransitionFields = Pick<
	GameSession,
	| "committedTransitionAtom"
	| "failStop"
	| "getFatalError"
	| "getSnapshot"
	| "getTransitionSnapshot"
	| "runFx"
	| "subscribeFatalError"
	| "subscribeTransitions"
>;

export interface TestGameTransitionFields extends TransitionFields {
	readonly committedTransitionRef: SubscriptionRef.SubscriptionRef<CommittedTransitionSchema.Type>;
	readonly publishRuntimeFx: (
		runtime: RuntimeSchema.Type,
		events?: CommittedTransitionSchema.Type["events"],
	) => Effect.Effect<void>;
	readonly resetRuntimeFx: (runtime: RuntimeSchema.Type) => Effect.Effect<void>;
}

/** Builds transition fields for a test Game from one real authoritative SubscriptionRef. */
export const makeTestGameTransitionFieldsFx = Effect.fn("makeTestGameTransitionFieldsFx")(
	(initialRuntime: RuntimeSchema.Type) =>
		Effect.gen(function* () {
			const ref = yield* SubscriptionRef.make<CommittedTransitionSchema.Type>({
				sequence: 0,
				previousRuntime: null,
				runtime: initialRuntime,
				events: [],
			});
			const committedTransitionSubscriptionAtom = Atom.subscriptionRef(ref);
			const committedTransitionAtom: GameSession["committedTransitionAtom"] = Atom.readable(
				(get) => get(committedTransitionSubscriptionAtom),
			);
			const getTransitionSnapshot = () => SubscriptionRef.getUnsafe(ref);

			return {
				committedTransitionAtom,
				committedTransitionRef: ref,
				failStop: (source, cause) =>
					new GameSessionFatalError({
						source,
						cause,
					}),
				getFatalError: () => null,
				getSnapshot: () => getTransitionSnapshot().runtime,
				getTransitionSnapshot,
				runFx: ((effect: Effect.Effect<unknown, unknown>) =>
					effect) as GameSession["runFx"],
				subscribeFatalError: () => () => undefined,
				subscribeTransitions: (listener) => {
					void listener(getTransitionSnapshot());
					return () => undefined;
				},
				publishRuntimeFx: (
					runtime: RuntimeSchema.Type,
					events: CommittedTransitionSchema.Type["events"] = [],
				) =>
					Effect.gen(function* () {
						const previous = yield* SubscriptionRef.get(ref);
						yield* SubscriptionRef.set(ref, {
							sequence: previous.sequence + 1,
							previousRuntime: previous.runtime,
							runtime,
							events,
						});
					}),
				resetRuntimeFx: (runtime: RuntimeSchema.Type) =>
					SubscriptionRef.set(ref, {
						sequence: 0,
						previousRuntime: null,
						runtime,
						events: [],
					}),
			} satisfies TestGameTransitionFields;
		}),
);
