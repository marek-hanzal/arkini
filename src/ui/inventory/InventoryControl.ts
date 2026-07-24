import type { Effect } from "effect";

export type InventoryState =
	| {
			readonly phase: "closed";
	  }
	| {
			readonly phase: "open";
			readonly origin: HTMLElement | null;
	  };

export interface OpenInventoryProps {
	readonly origin?: HTMLElement | null;
}

export interface CloseInventoryProps {
	readonly restoreFocus?: boolean;
}

/** Canvas-local presentation owner for the one active Inventory surface. */
export interface InventoryControl {
	readonly state: InventoryState;
	readonly isOpen: boolean;
	readonly openFx: (props?: OpenInventoryProps) => Effect.Effect<boolean>;
	readonly closeFx: (props?: CloseInventoryProps) => Effect.Effect<boolean>;
}
