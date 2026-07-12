import { Clock, Effect, Layer, Ref, SynchronizedRef } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { fromConfigFx } from "~/v1/runtime/fx/fromConfigFx";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { TickFx } from "~/v1/tick/context/TickFx";

export namespace GameLayerFx {
	export interface Props {
		config: GameConfigSchema.Type;
	}
}
export const GameLayerFx = ({ config }: GameLayerFx.Props) => {
	const configLayer = Layer.succeed(GameConfigFx, config);
	const runtimeStoreLayer = Layer.effect(
		RuntimeStoreFx,
		fromConfigFx().pipe(Effect.flatMap(SynchronizedRef.make)),
	);
	const runtimeReadLayer = Layer.effect(
		RuntimeFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => ({
				read: SynchronizedRef.get(store),
			})),
		),
	);
	const runtimeLayer = Layer.merge(
		runtimeStoreLayer,
		runtimeReadLayer.pipe(Layer.provide(runtimeStoreLayer)),
	);
	const tickLayer = Layer.effect(
		TickFx,
		Effect.gen(function* () {
			const nowMs = yield* Clock.currentTimeMillis;
			const ref = yield* Ref.make({
				nowMs,
				elapsedMs: 0,
			});
			return {
				read: Ref.get(ref),
				set: (tick) => Ref.set(ref, tick),
			};
		}),
	);
	return Layer.mergeAll(configLayer, runtimeLayer, tickLayer);
};
