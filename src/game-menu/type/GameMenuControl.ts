export type GameMenuPhase = "closed" | "entering" | "open" | "exiting";

export type GameMenuAction =
	| "save"
	| "save-and-exit"
	| "hard-reset"
	| "main-menu"
	| "settings"
	| "cheats";

/** Synchronous game-menu intent plus transition completion at the game-shell boundary. */
export interface GameMenuControl {
	readonly phase: GameMenuPhase;
	readonly activeAction: GameMenuAction | null;
	readonly openFn: () => void;
	readonly closeFn: () => void;
	readonly toggleFn: () => void;
	readonly beginActionFn: (action: GameMenuAction) => boolean;
	readonly completeActionFn: (action: GameMenuAction) => void;
	readonly completeEnterFn: () => void;
	readonly completeExitFn: () => void;
}
