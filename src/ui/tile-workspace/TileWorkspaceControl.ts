import type { TileItemId } from "~/bridge/tile/TileItemId";

export type TileWorkspacePhase = "closed" | "entering" | "open" | "exiting";

export interface TileWorkspaceTarget {
	readonly capability: "info" | "status" | "lines" | "effects";
	readonly itemId: TileItemId;
	readonly origin: HTMLElement | null;
	readonly generation: number;
}

/** Canvas-local lifecycle owner for one focused tile capability workspace. */
export interface TileWorkspaceControl {
	readonly phase: TileWorkspacePhase;
	readonly isOpen: boolean;
	readonly target: TileWorkspaceTarget | null;
	readonly openInfo: (itemId: TileItemId, origin: HTMLElement | null) => boolean;
	readonly openStatus: (itemId: TileItemId, origin: HTMLElement | null) => boolean;
	readonly openLines: (itemId: TileItemId, origin: HTMLElement | null) => boolean;
	readonly openEffects: (itemId: TileItemId, origin: HTMLElement | null) => boolean;
	readonly close: () => Promise<void>;
	readonly completeEnter: (generation: number) => void;
	readonly completeExit: (generation: number) => void;
}
