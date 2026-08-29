import { useCallback } from "react";

import { RendererRuntime } from "~/application-runtime/RendererRuntime";
import { CheatItemSpotlight } from "~/ui/cheat-spotlight/CheatItemSpotlight";
import { useGameEngine } from "~/ui/game/useGameEngine";
import { PixiBoardToolbarSurface } from "~/ui/pixi/PixiBoardToolbarSurface";
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
			<div
				className="size-full min-h-0 min-w-0"
				data-ui="GameBoardLayout"
			>
				<PixiBoardToolbarSurface onOpenInventory={onOpenInventory} />
			</div>
			<CheatItemSpotlight
				alwaysAvailable={cheatAlwaysAvailable}
				game={game}
				onBeforeOpen={cancelInteraction}
			/>
		</>
	);
};
