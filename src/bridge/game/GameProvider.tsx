import type { ReactNode } from "react";

import type { Game } from "~/bridge/game/Game";
import { GameContext } from "~/bridge/game/GameContext";

export namespace GameProvider {
	export interface Props {
		children: ReactNode;
		game: Game;
	}
}

/** Provides one replaceable live game instance to the game UI subtree. */
export const GameProvider = ({ children, game }: GameProvider.Props) => (
	<GameContext.Provider value={game}>{children}</GameContext.Provider>
);
