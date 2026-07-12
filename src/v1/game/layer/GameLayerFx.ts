import { GameCoreLayerFx } from "~/v1/game/layer/GameCoreLayerFx";

/**
 * Backwards-compatible core game layer used by deterministic tests and composed effects.
 * Browser sessions use GameSessionLayerFx so the scoped production loop has one owner.
 */
export const GameLayerFx = GameCoreLayerFx;

export namespace GameLayerFx {
	export interface Props extends GameCoreLayerFx.Props {}
}
