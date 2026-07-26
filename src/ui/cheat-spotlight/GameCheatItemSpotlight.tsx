import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/** Keeps the cheat spotlight Board-only while sharing higher game-scene owners. */
export const GameCheatItemSpotlight = () => {
	const game = useGameEngine();
	const { interaction } = usePixiGameRuntime();
	return (
		<CheatItemSpotlight
			game={game}
			onBeforeOpen={() => RendererRuntime.runSync(interaction.cancelFx)}
		/>
	);
};
