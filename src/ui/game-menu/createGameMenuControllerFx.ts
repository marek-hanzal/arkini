import { Effect } from "effect";

import type { GameMenuAction, GameMenuPhase } from "~/ui/game-menu/GameMenuControl";

interface ExitCompletion {
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

export interface GameMenuController {
	readonly getSnapshot: () => GameMenuController.Snapshot;
	readonly subscribe: (listener: () => void) => () => void;
	readonly openFx: Effect.Effect<void>;
	readonly closeFx: Effect.Effect<Promise<void>>;
	readonly toggleFx: Effect.Effect<void>;
	readonly beginActionFx: (action: GameMenuAction) => Effect.Effect<boolean>;
	readonly completeActionFx: (action: GameMenuAction) => Effect.Effect<void>;
	readonly completeEnterFx: Effect.Effect<void>;
	readonly completeExitFx: Effect.Effect<void>;
	readonly resetFx: Effect.Effect<void>;
}

export namespace GameMenuController {
	export interface Snapshot {
		readonly phase: GameMenuPhase;
		readonly activeAction: GameMenuAction | null;
	}
}

const initialSnapshot = {
	phase: "closed",
	activeAction: null,
} as const satisfies GameMenuController.Snapshot;

/** Creates the one synchronous external owner for the complete Game Menu lifecycle. */
export const createGameMenuControllerFx = Effect.fn("createGameMenuControllerFx")(() =>
	Effect.sync(() => {
		const listeners = new Set<() => void>();
		let snapshot: GameMenuController.Snapshot = initialSnapshot;
		let exitCompletion: ExitCompletion | undefined;

		const publish = (next: GameMenuController.Snapshot) => {
			if (snapshot.phase === next.phase && snapshot.activeAction === next.activeAction) {
				return;
			}
			snapshot = next;
			for (const listener of Array.from(listeners)) listener();
		};

		const open = () => {
			if (snapshot.activeAction !== null || snapshot.phase !== "closed") return;
			publish({
				...snapshot,
				phase: "entering",
			});
		};

		const close = () => {
			if (snapshot.activeAction !== null || snapshot.phase === "closed") {
				return Promise.resolve();
			}
			if (snapshot.phase === "exiting") {
				return exitCompletion?.promise ?? Promise.resolve();
			}
			let resolveExit: () => void = () => undefined;
			const promise = new Promise<void>((resolve) => {
				resolveExit = resolve;
			});
			exitCompletion = {
				promise,
				resolve: resolveExit,
			};
			publish({
				...snapshot,
				phase: "exiting",
			});
			return promise;
		};

		const toggle = () => {
			if (snapshot.activeAction !== null) return;
			if (snapshot.phase === "closed") {
				open();
				return;
			}
			if (snapshot.phase === "entering" || snapshot.phase === "open") void close();
		};

		const beginAction = (action: GameMenuAction) => {
			if (snapshot.activeAction !== null || snapshot.phase !== "open") return false;
			publish({
				...snapshot,
				activeAction: action,
			});
			return true;
		};

		const completeAction = (action: GameMenuAction) => {
			if (snapshot.activeAction !== action) return;
			publish({
				...snapshot,
				activeAction: null,
			});
		};

		const completeEnter = () => {
			if (snapshot.phase !== "entering") return;
			publish({
				...snapshot,
				phase: "open",
			});
		};

		const completeExit = () => {
			if (snapshot.phase !== "exiting") return;
			publish({
				...snapshot,
				phase: "closed",
			});
			exitCompletion?.resolve();
			exitCompletion = undefined;
		};

		return {
			getSnapshot: () => snapshot,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			openFx: Effect.sync(open),
			closeFx: Effect.sync(close),
			toggleFx: Effect.sync(toggle),
			beginActionFx: (action) => Effect.sync(() => beginAction(action)),
			completeActionFx: (action) => Effect.sync(() => completeAction(action)),
			completeEnterFx: Effect.sync(completeEnter),
			completeExitFx: Effect.sync(completeExit),
			resetFx: Effect.sync(() => {
				exitCompletion?.resolve();
				exitCompletion = undefined;
				snapshot = initialSnapshot;
			}),
		} satisfies GameMenuController;
	}),
);
