import type { PropsWithChildren } from "react";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { GameEngineContext } from "~/game-presentation/context/GameEngineContext";

/** Publishes one exact playable session to shared gameplay presentation. */
export const GameEngineProvider = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: GameEngine;
}>) => <GameEngineContext value={game}>{children}</GameEngineContext>;
