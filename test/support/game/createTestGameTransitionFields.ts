import type { GameSession } from "~/bridge/game/GameSession";

type TransitionFields = Pick<
	GameSession,
	| "getSnapshot"
	| "getTransitionSnapshot"
	| "canClaimTilePresentationTransition"
	| "claimTilePresentationTransition"
	| "subscribeTransitions"
>;

/** Supplies the real transition contract to focused Game test doubles. */
export const createTestGameTransitionFields = (
	getSnapshot: GameSession["getSnapshot"],
): TransitionFields => {
	let claimedSequence = -1;
	const getTransitionSnapshot: GameSession["getTransitionSnapshot"] = () => ({
		sequence: 0,
		previousRuntime: null,
		runtime: getSnapshot(),
		events: [],
	});

	return {
		getSnapshot,
		getTransitionSnapshot,
		canClaimTilePresentationTransition: (sequence) => sequence > claimedSequence,
		claimTilePresentationTransition: (sequence) => {
			if (sequence <= claimedSequence) return false;
			claimedSequence = sequence;
			return true;
		},
		subscribeTransitions: (listener) => {
			void listener(getTransitionSnapshot());
			return () => undefined;
		},
	};
};
