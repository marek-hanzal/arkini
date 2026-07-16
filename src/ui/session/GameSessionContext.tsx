import { createContext, type ReactNode, useContext } from "react";

import type { GameSession } from "~/ui/session/GameSession";

const GameSessionContext = createContext<GameSession | null>(null);

export namespace GameSessionProvider {
	export interface Props {
		children: ReactNode;
		session: GameSession;
	}
}

/** Provides one already-created stable game session to the React tree. */
export const GameSessionProvider = ({ children, session }: GameSessionProvider.Props) => (
	<GameSessionContext.Provider value={session}>{children}</GameSessionContext.Provider>
);

export const useGameSession = () => {
	const session = useContext(GameSessionContext);
	if (session === null) throw new Error("GameSessionProvider is missing.");
	return session;
};
