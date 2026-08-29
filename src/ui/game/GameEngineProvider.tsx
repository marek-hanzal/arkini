import type { PropsWithChildren } from "react";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { GameEngineContext } from "~/ui/game/GameEngineContext";

/** Publishes one exact playable session to shared gameplay presentation. */
export const GameEngineProvider = ({
	children,
	game,
}: PropsWithChildren<{
	readonly game: GameEngine;
}>) => <GameEngineContext value={game}>{children}</GameEngineContext>;
