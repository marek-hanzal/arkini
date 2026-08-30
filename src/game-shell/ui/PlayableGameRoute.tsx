import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { GameAudio } from "~/game-audio/ui/GameAudio";
import { CheatItemSpawnProvider } from "~/game-cheat/ui/CheatItemSpawnProvider";

/** Mounts exact-Game React resources only for playable scene and cheat routes. */
export const PlayableGameRoute = ({ children }: PropsWithChildren) => {
	const game = useGameEngine();
	return (
		<CheatItemSpawnProvider game={game}>
			<GameAudio />
			{children}
		</CheatItemSpawnProvider>
	);
};
