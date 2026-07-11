import { Effect } from "effect";

import { GameLayerFx } from "~/v1/game/layer/GameLayerFx";
import type { GameConfigSchema } from "~/v1/schema/GameConfigSchema";

export namespace useGameFx {
	export interface Props {
		config: GameConfigSchema.Type;
	}
}

/**
 * Provides every service owned by one loaded game to an Effect program.
 *
 * This intentionally returns Effect's native `provide` operator instead of
 * manually mapping success, error, or requirement generics.
 */
export const useGameFx = ({ config }: useGameFx.Props) => {
	return Effect.provide(GameLayerFx(config));
};
