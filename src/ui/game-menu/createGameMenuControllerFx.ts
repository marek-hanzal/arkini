import { Deferred, Effect } from "effect";

import type { GameMenuAction, GameMenuPhase } from "~/ui/game-menu/GameMenuControl";

interface ExitCompletion {
	readonly deferred: Deferred.Deferred<void>;
}

interface GameMenuController {
	readonly getSnapshot: () => GameMenuController.Snapshot;
	readonly subscribe: (listener: () => void) => () => void;
	readonly openFx: Effect.Effect<void>;
	readonly closeFx: () => Effect.Effect<void>;
	readonly toggleFx: Effect.Effect<void>;
	readonly beginActionFx: (action: GameMenuAction) => Effect.Effect<boolean>;
	readonly completeActionFx: (action: GameMenuAction) => Effect.Effect<void>;
	readonly completeEnterFx: Effect.Effect<void>;
	readonly completeExitFx: Effect.Effect<void>;
	readonly resetFx: Effect.Effect<void>;
}

namespace GameMenuController {
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

		const openFx = Effect.sync(() => {
			if (snapshot.activeAction !== null || snapshot.phase !== "closed") return;
			publish({
				...snapshot,
				phase: "entering",
			});
		});

		const closeFx = Effect.fn("GameMenuController.closeFx")(() =>
			Effect.gen(function* () {
				if (snapshot.activeAction !== null || snapshot.phase === "closed") return;
				if (snapshot.phase === "exiting") {
					if (exitCompletion !== undefined) {
						yield* Deferred.await(exitCompletion.deferred);
					}
					return;
				}
				const deferred = yield* Deferred.make<void>();
				exitCompletion = {
					deferred,
				};
				publish({
					...snapshot,
					phase: "exiting",
				});
				yield* Deferred.await(deferred);
			}),
		);

		const toggleFx = Effect.suspend(() => {
			if (snapshot.activeAction !== null || snapshot.phase === "exiting") return Effect.void;
			if (snapshot.phase === "closed") return openFx;
			return closeFx();
		});

		const beginActionFx = Effect.fn("GameMenuController.beginActionFx")(
			(action: GameMenuAction) =>
				Effect.sync(() => {
					if (snapshot.activeAction !== null || snapshot.phase !== "open") return false;
					publish({
						...snapshot,
						activeAction: action,
					});
					return true;
				}),
		);

		const completeActionFx = Effect.fn("GameMenuController.completeActionFx")(
			(action: GameMenuAction) =>
				Effect.sync(() => {
					if (snapshot.activeAction !== action) return;
					publish({
						...snapshot,
						activeAction: null,
					});
				}),
		);

		const completeEnterFx = Effect.sync(() => {
			if (snapshot.phase !== "entering") return;
			publish({
				...snapshot,
				phase: "open",
			});
		});

		const completeExitFx = Effect.gen(function* () {
			if (snapshot.phase !== "exiting") return;
			const completion = exitCompletion;
			exitCompletion = undefined;
			publish({
				...snapshot,
				phase: "closed",
			});
			if (completion !== undefined) {
				yield* Deferred.succeed(completion.deferred, undefined);
			}
		});

		return {
			getSnapshot: () => snapshot,
			subscribe: (listener) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			openFx,
			closeFx,
			toggleFx,
			beginActionFx,
			completeActionFx,
			completeEnterFx,
			completeExitFx,
			resetFx: Effect.gen(function* () {
				const completion = exitCompletion;
				exitCompletion = undefined;
				snapshot = initialSnapshot;
				if (completion !== undefined) {
					yield* Deferred.succeed(completion.deferred, undefined);
				}
			}),
		} satisfies GameMenuController;
	}),
);
