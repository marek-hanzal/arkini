import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailTabEnumSchema } from "~/engine/item-detail/schema/ItemDetailTabEnumSchema";

export interface ItemDetailTarget {
	readonly itemId: IdSchema.Type;
	readonly tab: ItemDetailTabEnumSchema.Type;
	readonly origin: HTMLElement | null;
}

export type ItemDetailState =
	| {
			readonly phase: "closed";
	  }
	| {
			readonly phase: "entering";
			readonly target: ItemDetailTarget;
			readonly generation: number;
	  }
	| {
			readonly phase: "open";
			readonly target: ItemDetailTarget;
			readonly generation: number;
	  }
	| {
			readonly phase: "exiting";
			readonly target: ItemDetailTarget;
			readonly generation: number;
			readonly restoreFocus: boolean;
	  };

export interface CloseItemDetailProps {
	readonly restoreFocus?: boolean;
}

export interface OpenItemDetailProps {
	readonly itemId: IdSchema.Type;
	readonly tab: ItemDetailTabEnumSchema.Type;
	readonly origin?: HTMLElement | null;
}

/** Canvas-local owner for one exact capability-tabbed Item Detail modal. */
export interface ItemDetailControl {
	readonly state: ItemDetailState;
	readonly isOpen: boolean;
	readonly openItemDetail: (props: OpenItemDetailProps) => boolean;
	readonly close: (props?: CloseItemDetailProps) => Promise<void>;
	readonly completeEnter: (generation: number) => void;
	readonly completeExit: (generation: number) => void;
}
