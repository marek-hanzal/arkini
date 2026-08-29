import type { PropsWithChildren } from "react";

import { useGameEngine } from "~/ui/game/useGameEngine";
import { GameAudio } from "~/ui/audio/GameAudio";
import { CheatItemSpawnProvider } from "~/ui/cheat-spotlight/CheatItemSpawnProvider";

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
