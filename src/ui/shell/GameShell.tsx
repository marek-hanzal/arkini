import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { ItemDetailHigherOwnerGuard } from "~/ui/item-detail/ItemDetailHigherOwnerGuard";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";
import { PixiGameProvider } from "~/ui/pixi/PixiGameProvider";

const GameTileScene = ({ children }: PropsWithChildren) => (
	<div
		className="relative isolate z-0 size-full min-h-0 min-w-0"
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
			<ItemDetailProvider>
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

/** Keeps shared playable-scene owners alive while one routed Pixi leaf is active. */
export function GameShell({ children }: PropsWithChildren) {
	const gameEngine = useGameEngine();
	return (
		<main
			className="relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground outline-none"
			data-ui="GameShell"
			tabIndex={-1}
		>
			<GameMenuProvider>
				<GameShellLayers game={gameEngine}>{children}</GameShellLayers>
			</GameMenuProvider>
		</main>
	);
}
