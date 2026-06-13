import type { ItemId } from "./manifestId";

export interface ProducerDefinition {
	trigger: "click";
	placement: "board_then_inventory";
	output: readonly ProducerOutput[];
	cooldownMs?: number;
	mode?: ProducerMode;
	doubleClickBehavior?: "exhaust";
}

export type ProducerMode =
	| {
			type: "infinite";
	  }
	| {
			type: "finite";
			charges: number;
			onDepleted:
				| "remove"
				| {
						replaceWithItemId: ItemId;
				  };
	  };

export type ProducerOutput =
	| {
			type: "guaranteed";
			itemId: ItemId;
			quantity?: Quantity;
	  }
	| {
			type: "chance";
			itemId: ItemId;
			probability: number;
			quantity?: Quantity;
	  }
	| {
			type: "weighted";
			rolls?: Quantity;
			entries: readonly ProducerWeightedEntry[];
	  };

export type ProducerWeightedEntry =
	| {
			itemId: ItemId;
			weight: number;
			quantity?: Quantity;
	  }
	| {
			itemId: null;
			weight: number;
			quantity?: never;
	  };

export type Quantity =
	| number
	| {
			min: number;
			max: number;
	  };
