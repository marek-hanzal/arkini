import type { PropsWithChildren } from "react";

import { GameEngineContext } from "~/bridge/game/GameEngineContext";
import type { GameEngine } from "~/bridge/game/GameEngine";

/** Publishes one exact playable session to shared gameplay presentation. */
export const GameEngineProvider = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: GameEngine;
}>) => <GameEngineContext value={game}>{children}</GameEngineContext>;
