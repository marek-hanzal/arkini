import { Effect } from "effect";

import { GameLayerFx } from "~/engine/game/layer/GameLayerFx";

export namespace useGameFx {
	export interface Props extends GameLayerFx.Props {}
}

/**
 * Provides every service owned by one loaded game to an Effect program.
 *
 * This intentionally returns Effect's native `provide` operator instead of
 * manually mapping success, error, or requirement generics.
 */
export const useGameFx = (props: useGameFx.Props) => {
	return Effect.provide(GameLayerFx(props));
};
