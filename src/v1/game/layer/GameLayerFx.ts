import { Effect, Layer, SynchronizedRef } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { fromConfigFx } from "~/v1/runtime/fx/fromConfigFx";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

export namespace GameLayerFx {
	export interface Props {
		config: GameConfigSchema.Type;
	}
}

/**
 * Builds the root layer providing every service owned by one loaded game.
 *
 * The mutable runtime store remains internal. Callers receive only read-only
 * runtime access plus dedicated atomic command effects.
 */
export const GameLayerFx = ({ config }: GameLayerFx.Props) => {
	const configLayer = Layer.succeed(GameConfigFx, config);
	const runtimeStoreLayer = Layer.effect(
		RuntimeStoreFx,
		fromConfigFx().pipe(
			Effect.flatMap((runtime) => {
				return SynchronizedRef.make(runtime);
			}),
		),
	);
	const runtimeReadLayer = Layer.effect(
		RuntimeFx,
		RuntimeStoreFx.pipe(
			Effect.map((store) => {
				return {
					read: SynchronizedRef.get(store),
				};
			}),
		),
	);
	const runtimeLayer = Layer.merge(
		runtimeStoreLayer,
		runtimeReadLayer.pipe(Layer.provide(runtimeStoreLayer)),
	);

	return Layer.merge(configLayer, runtimeLayer);
};
