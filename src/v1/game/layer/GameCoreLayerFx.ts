import { Effect, Layer, Option, Sink, Stream, SubscriptionRef } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { CommittedTransitionsFx } from "~/v1/runtime/context/CommittedTransitionsFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { CommittedTransitionSchema } from "~/v1/runtime/schema/CommittedTransitionSchema";
import { fromConfigFx } from "~/v1/runtime/fx/fromConfigFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { TickFx } from "~/v1/tick/context/TickFx";
import { makeTickFx } from "~/v1/tick/internal/makeTickFx";

export namespace GameCoreLayerFx {
	export interface Props {
		config: GameConfigSchema.Type;
		state?: StateSchema.Type;
	}
}

/** Builds the stateful services owned by one loaded game without starting background work. */
export const GameCoreLayerFx = ({ config, state }: GameCoreLayerFx.Props) => {
	const configLayer = Layer.succeed(GameConfigFx, config);
	const runtimeStoreLayer = Layer.effect(
		RuntimeStoreFx,
		(state === undefined
			? fromConfigFx()
			: fromStateFx({
					state,
				})
		).pipe(
			Effect.map(
				(runtime): CommittedTransitionSchema.Type => ({
					runtime,
					events: [],
				}),
			),
			Effect.flatMap(SubscriptionRef.make),
			Effect.provide(configLayer),
		),
	);
	const runtimeReadLayer = Layer.effect(
		RuntimeFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => ({
				read: SubscriptionRef.get(store).pipe(
					Effect.map((transition) => transition.runtime),
				),
			})),
		),
	).pipe(Layer.provide(runtimeStoreLayer));
	const committedTransitionsLayer = Layer.effect(
		CommittedTransitionsFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => ({
				subscribe: store.changes.pipe(
					Stream.changesWith(Object.is),
					Stream.peel(Sink.head<CommittedTransitionSchema.Type>()),
					Effect.map(([current, changes]) => ({
						current: Option.getOrThrow(current),
						changes,
					})),
				),
			})),
		),
	).pipe(Layer.provide(runtimeStoreLayer));
	const tickLayer = Layer.effect(TickFx, makeTickFx());

	return Layer.mergeAll(
		configLayer,
		runtimeStoreLayer,
		runtimeReadLayer,
		committedTransitionsLayer,
		tickLayer,
	);
};
