import { createContext, type FC, type ReactNode, useContext, useEffect, useMemo } from "react";
import { createGameAudioPlayer, type GameAudioPlayer } from "~/audio/GameAudioPlayer";

const GameAudioContext = createContext<GameAudioPlayer | null>(null);

export namespace GameAudioProvider {
	export interface Props {
		children: ReactNode;
	}
}

export const GameAudioProvider: FC<GameAudioProvider.Props> = ({ children }) => {
	const player = useMemo(() => createGameAudioPlayer(), []);

	useEffect(() => {
		const unlock = () => player.unlock();
		window.addEventListener("pointerdown", unlock, {
			capture: true,
			once: true,
		});
		window.addEventListener("keydown", unlock, {
			capture: true,
			once: true,
		});

		return () => {
			window.removeEventListener("pointerdown", unlock, {
				capture: true,
			});
			window.removeEventListener("keydown", unlock, {
				capture: true,
			});
			player.destroy();
		};
	}, [
		player,
	]);

	return <GameAudioContext.Provider value={player}>{children}</GameAudioContext.Provider>;
};

export const useGameAudio = (): GameAudioPlayer => {
	const player = useContext(GameAudioContext);
	if (!player) {
		throw new Error("GameAudioProvider is missing.");
	}

	return player;
};
