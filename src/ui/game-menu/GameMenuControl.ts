export type GameMenuPhase = "closed" | "entering" | "open" | "exiting";

/** Synchronous game-menu intent plus transition completion at the game-shell boundary. */
export interface GameMenuControl {
	readonly phase: GameMenuPhase;
	readonly isOpen: boolean;
	readonly routePending: boolean;
	readonly open: () => void;
	readonly close: () => Promise<void>;
	readonly toggle: () => void;
	readonly beginRouteRequest: () => boolean;
	readonly completeRouteRequest: () => void;
	readonly completeEnter: () => void;
	readonly completeExit: () => void;
}
