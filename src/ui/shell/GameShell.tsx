import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
import { ItemDetailHigherOwnerGuard } from "~/ui/item-detail/ItemDetailHigherOwnerGuard";
import { ItemDetailModal } from "~/ui/item-detail/ItemDetailModal";
import { ItemDetailProvider } from "~/ui/item-detail/ItemDetailProvider";
import { gameBoardViewTransitionName } from "~/ui/navigation/gameBoardViewTransitionName";
import { TileSystemProvider } from "~/ui/tile/TileSystemProvider";

/** Renders the one playable board leaf over its route-scoped Game Engine. */
export function GameShell({ children }: PropsWithChildren) {
	const gameEngine = useGameEngine();
	return (
		<main
			className="relative size-full min-h-0 min-w-0 overflow-hidden bg-canvas text-foreground outline-none"
			data-ui="GameShell"
			tabIndex={-1}
		>
			<GameMenuProvider>
				<ItemDetailProvider>
					<ItemDetailHigherOwnerGuard />
					<div
						className="relative size-full min-h-0 min-w-0"
						data-ui="TileScene"
						style={{
							viewTransitionName: gameBoardViewTransitionName,
						}}
					>
						<TileSystemProvider>{children}</TileSystemProvider>
					</div>
					<ItemDetailModal />
				</ItemDetailProvider>
				<GameMenu game={gameEngine} />
			</GameMenuProvider>
		</main>
	);
}
