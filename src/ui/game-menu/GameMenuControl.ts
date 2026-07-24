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
	readonly isOpen: boolean;
	readonly activeAction: GameMenuAction | null;
	readonly routePending: boolean;
	readonly open: () => void;
	readonly close: () => Promise<void>;
	readonly toggle: () => void;
	readonly beginAction: (action: GameMenuAction) => boolean;
	readonly completeAction: (action: GameMenuAction) => void;
	readonly completeEnter: () => void;
	readonly completeExit: () => void;
}
