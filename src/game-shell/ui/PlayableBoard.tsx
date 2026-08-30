import { useCallback } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { CheatItemSpotlight } from "~/game-cheat/ui/CheatItemSpotlight";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { PixiBoardToolbarSurface } from "~/game-scene/ui/PixiBoardToolbarSurface";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";

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
