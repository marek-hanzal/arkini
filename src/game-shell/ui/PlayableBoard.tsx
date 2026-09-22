import { useCallback } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { CheatItemSpotlight } from "~/game-cheat/ui/CheatItemSpotlight";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { PixiBoardSurface } from "~/game-scene/ui/PixiBoardSurface";
import { usePixiGameRuntime } from "~/game-scene/ui/PixiGameRuntime";

/** Shared Board gameplay leaf with its exact cheat presentation. */
export const PlayableBoard = ({
	cheatAlwaysAvailable,
}: {
	readonly cheatAlwaysAvailable?: boolean;
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
				<PixiBoardSurface />
			</div>
			<CheatItemSpotlight
				alwaysAvailable={cheatAlwaysAvailable}
				game={game}
				onBeforeOpenFn={cancelInteractionFn}
			/>
		</>
	);
};
