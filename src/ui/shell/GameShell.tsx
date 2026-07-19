import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { GameMenu } from "~/ui/game-menu/GameMenu";
import { GameMenuProvider } from "~/ui/game-menu/GameMenuProvider";
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
				<TileSystemProvider>{children}</TileSystemProvider>
				<GameMenu game={gameEngine} />
			</GameMenuProvider>
		</main>
	);
}
