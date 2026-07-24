import type { GameMenuPhase } from "~/ui/game-menu/GameMenuControl";

interface ExitCompletion {
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

export interface GameMenuController {
	readonly getSnapshot: () => GameMenuController.Snapshot;
	readonly subscribe: (listener: () => void) => () => void;
	readonly open: () => void;
	readonly close: () => Promise<void>;
	readonly toggle: () => void;
	readonly beginRouteRequest: () => boolean;
	readonly completeRouteRequest: () => void;
	readonly completeEnter: () => void;
	readonly completeExit: () => void;
	readonly reset: () => void;
}

export namespace GameMenuController {
	export interface Snapshot {
		readonly phase: GameMenuPhase;
		readonly routePending: boolean;
	}
}

const initialSnapshot = {
	phase: "closed",
	routePending: false,
} as const satisfies GameMenuController.Snapshot;

/** Creates one synchronous external owner for the complete Game Menu lifecycle. */
export const createGameMenuController = (): GameMenuController => {
	const listeners = new Set<() => void>();
	let snapshot: GameMenuController.Snapshot = initialSnapshot;
	let exitCompletion: ExitCompletion | undefined;

	const publish = (next: GameMenuController.Snapshot) => {
		if (snapshot.phase === next.phase && snapshot.routePending === next.routePending) {
			return;
		}
		snapshot = next;
		for (const listener of Array.from(listeners)) listener();
	};

	const open = () => {
		if (snapshot.routePending || snapshot.phase !== "closed") return;
		publish({
			...snapshot,
			phase: "entering",
		});
	};

	const close = () => {
		if (snapshot.routePending || snapshot.phase === "closed") return Promise.resolve();
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
		if (snapshot.routePending) return;
		if (snapshot.phase === "closed") {
			open();
			return;
		}
		if (snapshot.phase === "entering" || snapshot.phase === "open") void close();
	};

	const beginRouteRequest = () => {
		if (snapshot.routePending || snapshot.phase !== "open") return false;
		publish({
			...snapshot,
			routePending: true,
		});
		return true;
	};

	const completeRouteRequest = () => {
		if (!snapshot.routePending) return;
		publish({
			...snapshot,
			routePending: false,
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
		open,
		close,
		toggle,
		beginRouteRequest,
		completeRouteRequest,
		completeEnter,
		completeExit,
		reset: () => {
			exitCompletion?.resolve();
			exitCompletion = undefined;
			snapshot = initialSnapshot;
		},
	};
};
