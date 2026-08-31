import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { GameAudio } from "~/game-audio/ui/GameAudio";
import { CheatItemSpawnProvider } from "~/game-cheat/ui/CheatItemSpawnProvider";

/** Mounts exact-Game React resources for every playable Game surface. */
export const PlayableGameResources = ({ children }: PropsWithChildren) => {
	const game = useGameEngine();
	return (
		<CheatItemSpawnProvider game={game}>
			<GameAudio />
			{children}
		</CheatItemSpawnProvider>
	);
};
