import { Layer } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { fromConfigFx } from "~/v1/runtime/fx/fromConfigFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

export namespace GameLayerFx {
	export interface Props {
		config: GameConfigSchema.Type;
	}
}

/**
 * Builds the root layer providing every service owned by one loaded game.
 *
 * New game-wide services belong here so callers keep one stable composition
 * boundary instead of manually assembling individual service layers.
 */
export const GameLayerFx = ({ config }: GameLayerFx.Props) => {
	const configLayer = Layer.succeed(GameConfigFx, config);
	const runtimeLayer = Layer.effect(RuntimeFx, fromConfigFx()).pipe(Layer.provide(configLayer));

	return Layer.merge(configLayer, runtimeLayer);
};
