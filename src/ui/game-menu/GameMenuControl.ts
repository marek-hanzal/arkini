export type GameMenuPhase = "closed" | "entering" | "open" | "exiting";

/** Synchronous game-menu intent plus transition completion at the game-shell boundary. */
export interface GameMenuControl {
	readonly phase: GameMenuPhase;
	readonly isOpen: boolean;
	readonly open: () => void;
	readonly close: () => Promise<void>;
	readonly toggle: () => void;
	readonly completeEnter: () => void;
	readonly completeExit: () => void;
}
