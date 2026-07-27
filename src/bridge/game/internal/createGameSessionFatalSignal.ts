import {
	GameSessionFatalError,
	type GameSessionFatalSource,
} from "~/bridge/game/GameSessionFatalError";

export interface GameSessionFatalSignal {
	readonly getSnapshot: () => GameSessionFatalError | null;
	readonly report: (
		source: GameSessionFatalSource,
		cause: unknown,
		beforePublish: () => void,
	) => {
		readonly error: GameSessionFatalError;
		readonly published: boolean;
	};
	readonly subscribe: (listener: () => void) => () => void;
}

/** Small synchronous first-failure signal so bootstrap-time failures cannot be lost. */
export const createGameSessionFatalSignal = (): GameSessionFatalSignal => {
	let snapshot: GameSessionFatalError | null = null;
	const listeners = new Set<() => void>();

	return {
		getSnapshot: () => snapshot,
		report: (source, cause, beforePublish) => {
			if (snapshot !== null) {
				return {
					error: snapshot,
					published: false,
				};
			}

			snapshot =
				cause instanceof GameSessionFatalError
					? cause
					: new GameSessionFatalError({
							source,
							cause,
						});
			beforePublish();
			for (const listener of [
				...listeners,
			]) {
				try {
					listener();
				} catch {
					// The session is already frozen; one observer cannot hide the fatal
					// snapshot from later exact-resource observers.
				}
			}
			return {
				error: snapshot,
				published: true,
			};
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
};
