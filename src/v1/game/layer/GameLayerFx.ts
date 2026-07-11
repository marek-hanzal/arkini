import { Layer } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
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
	return Layer.succeed(GameConfigFx, config);
};
