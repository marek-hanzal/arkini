import { useCallback } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

export namespace GameCheatItemSpotlight {
	export interface Props {
		readonly alwaysAvailable?: boolean;
	}
}

/** Keeps the cheat spotlight Board-only while sharing higher game-scene owners. */
export const GameCheatItemSpotlight = ({ alwaysAvailable }: GameCheatItemSpotlight.Props) => {
	const game = useGameEngine();
	const { interaction } = usePixiGameRuntime();
	const onBeforeOpen = useCallback(() => {
		RendererRuntime.runSync(interaction.cancelFx);
	}, [
		interaction.cancelFx,
	]);
	return (
		<CheatItemSpotlight
			alwaysAvailable={alwaysAvailable}
			game={game}
			onBeforeOpen={onBeforeOpen}
		/>
	);
};
