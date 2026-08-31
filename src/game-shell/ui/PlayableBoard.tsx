import { useCallback } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { CheatItemSpotlight } from "~/game-cheat/ui/CheatItemSpotlight";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { PixiBoardToolbarSurface } from "~/game-scene/ui/PixiBoardToolbarSurface";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";

/** Shared Board + Toolbar gameplay leaf with its exact cheat presentation. */
export const PlayableBoard = ({
	cheatAlwaysAvailable,
	onOpenInventoryFn,
}: {
	readonly cheatAlwaysAvailable?: boolean;
	readonly onOpenInventoryFn: () => void | PromiseLike<void>;
}) => {
	const game = useGameEngine();
	const { interaction } = usePixiGameRuntime();
	const cancelInteractionFn = useCallback(() => {
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
				<PixiBoardToolbarSurface onOpenInventoryFn={onOpenInventoryFn} />
			</div>
			<CheatItemSpotlight
				alwaysAvailable={cheatAlwaysAvailable}
				game={game}
				onBeforeOpenFn={cancelInteractionFn}
			/>
		</>
	);
};
