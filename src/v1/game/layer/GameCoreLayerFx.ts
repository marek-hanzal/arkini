import { Effect, Layer, PubSub, Stream, SubscriptionRef } from "effect";

import { GameEventsFx } from "~/v1/event/context/GameEventsFx";
import { GameEventBusFx } from "~/v1/event/internal/GameEventBusFx";
import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { RuntimeChangesFx } from "~/v1/runtime/context/RuntimeChangesFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
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
		).pipe(Effect.flatMap(SubscriptionRef.make), Effect.provide(configLayer)),
	);
	const runtimeReadLayer = Layer.effect(
		RuntimeFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => ({
				read: SubscriptionRef.get(store),
			})),
		),
	).pipe(Layer.provide(runtimeStoreLayer));
	const runtimeChangesLayer = Layer.effect(
		RuntimeChangesFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => ({
				changes: store.changes.pipe(Stream.changesWith(Object.is)),
			})),
		),
	).pipe(Layer.provide(runtimeStoreLayer));
	const tickLayer = Layer.effect(TickFx, makeTickFx());
	const eventBusLayer = Layer.effect(
		GameEventBusFx,
		PubSub.sliding({
			capacity: 64,
		}),
	);
	const gameEventsLayer = Layer.effect(
		GameEventsFx,
		GameEventBusFx.pipe(
			Effect.map((bus) => ({
				subscribe: PubSub.subscribe(bus),
			})),
		),
	).pipe(Layer.provide(eventBusLayer));

	return Layer.mergeAll(
		configLayer,
		runtimeStoreLayer,
		runtimeReadLayer,
		runtimeChangesLayer,
		tickLayer,
		eventBusLayer,
		gameEventsLayer,
	);
};
