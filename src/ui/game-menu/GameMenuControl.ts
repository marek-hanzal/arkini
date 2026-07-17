/** Synchronous control surface for the active game's menu overlay. */
export interface GameMenuControl {
	readonly isOpen: boolean;
	readonly open: () => void;
	readonly close: () => void;
	readonly toggle: () => void;
}
