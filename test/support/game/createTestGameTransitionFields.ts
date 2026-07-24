import type { GameSession } from "~/bridge/game/GameSession";

type TransitionFields = Pick<
	GameSession,
	"getSnapshot" | "getTransitionSnapshot" | "subscribeTransitions"
>;

/** Supplies the real transition contract to focused Game test doubles. */
export const createTestGameTransitionFields = (
	getSnapshot: GameSession["getSnapshot"],
): TransitionFields => {
	const getTransitionSnapshot: GameSession["getTransitionSnapshot"] = () => ({
		sequence: 0,
		previousRuntime: null,
		runtime: getSnapshot(),
		events: [],
	});

	return {
		getSnapshot,
		getTransitionSnapshot,
		subscribeTransitions: (listener) => {
			void listener(getTransitionSnapshot());
			return () => undefined;
		},
	};
};
