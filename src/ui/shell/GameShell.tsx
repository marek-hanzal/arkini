import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { ItemDetailHigherOwnerGuard } from "~/ui/item-detail/ItemDetailHigherOwnerGuard";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";
import { RouteBackdrop } from "~/ui/navigation/RouteBackdrop";
import { PixiGameProvider } from "~/ui/pixi/PixiGameProvider";

const GameTileScene = ({ children }: PropsWithChildren) => (
	<div
		className="relative isolate z-10 size-full min-h-0 min-w-0"
		data-ui="TileScene"
		style={{
			viewTransitionName: gameBoardViewTransitionName,
		}}
	>
		<div
			className="size-full min-h-0 min-w-0"
			data-ui="GameSceneContent"
		>
			{children}
		</div>
	</div>
);

const GameShellLayers = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: ReturnType<typeof useGameEngine>;
}>) => {
	return (
		<>
			<ItemDetailProvider game={game}>
				<PixiGameProvider>
					<ItemDetailHigherOwnerGuard />
					<GameTileScene>{children}</GameTileScene>
					<ItemDetailModal />
				</PixiGameProvider>
			</ItemDetailProvider>
			<GameMenu game={game} />
		</>
	);
};

/**
 * React owner for route composition, focusable overlays and their precedence
 * across Board/Inventory navigation. The provider order is intentional: Item
 * Detail stays attached to the renderer scene, while Game Menu is the higher
 * interaction owner and dismisses Detail through ItemDetailHigherOwnerGuard.
 *
 * Gameplay remains outside this shell. Pixi surfaces present canonical bridge
 * projections and issue commands; neither React nor Pixi may infer committed
 * move/swap/stack outcomes. Tile input also stays immediate: ordinary click is
 * the primary action, while Shift+click requests Item Detail without introducing
 * delayed or double-click arbitration here.
 */
export function GameShell({ children }: PropsWithChildren) {
	const gameEngine = useGameEngine();
	return (
		<main
			className="relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground outline-none"
			data-ui="GameShell"
			tabIndex={-1}
		>
			<RouteBackdrop
				className="game-scene__backdrop pointer-events-none absolute inset-0 z-0"
				dataUi="GameSceneBackdrop"
			/>
			<GameMenuProvider>
				<GameShellLayers game={gameEngine}>{children}</GameShellLayers>
			</GameMenuProvider>
		</main>
	);
}
