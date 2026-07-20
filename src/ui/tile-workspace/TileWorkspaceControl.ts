import type { IdSchema } from "~/engine/common/schema/IdSchema";

export type TileWorkspacePhase = "closed" | "entering" | "open" | "exiting";

export interface TileWorkspaceTarget {
	readonly capability: "info" | "status";
	readonly itemId: IdSchema.Type;
	readonly origin: HTMLElement | null;
	readonly generation: number;
}

/** Canvas-local lifecycle owner for one focused tile capability workspace. */
export interface TileWorkspaceControl {
	readonly phase: TileWorkspacePhase;
	readonly isOpen: boolean;
	readonly target: TileWorkspaceTarget | null;
	readonly openInfo: (itemId: IdSchema.Type, origin: HTMLElement | null) => boolean;
	readonly openStatus: (itemId: IdSchema.Type, origin: HTMLElement | null) => boolean;
	readonly close: () => Promise<void>;
	readonly completeEnter: (generation: number) => void;
	readonly completeExit: (generation: number) => void;
}
