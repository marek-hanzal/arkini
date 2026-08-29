import { useCallback } from "react";

import { RendererRuntime } from "~/renderer/RendererRuntime";
import { GameBoardLayout } from "~/ui/board/GameBoardLayout";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { useGameEngine } from "~/ui/game/useGameEngine";
import { usePixiGameRuntime } from "~/ui/pixi/usePixiGameRuntime";

/** Shared Board + Toolbar gameplay leaf with its exact cheat presentation. */
export const PlayableBoard = ({
	cheatAlwaysAvailable,
	onOpenInventory,
}: {
	readonly cheatAlwaysAvailable?: boolean;
	readonly onOpenInventory: () => void | PromiseLike<void>;
}) => {
	const game = useGameEngine();
	const { interaction } = usePixiGameRuntime();
	const cancelInteraction = useCallback(() => {
		RendererRuntime.runSync(interaction.cancelFx);
	}, [
		interaction.cancelFx,
	]);

	return (
		<>
			<GameBoardLayout onOpenInventory={onOpenInventory} />
			<CheatItemSpotlight
				alwaysAvailable={cheatAlwaysAvailable}
				game={game}
				onBeforeOpen={cancelInteraction}
			/>
		</>
	);
};
