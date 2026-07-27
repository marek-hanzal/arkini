export interface ItemDetailQuantityBounds {
	readonly min: number;
	readonly max: number;
}

export type ItemDetailOutputRoll<Item> =
	| {
			readonly kind: "guaranteed";
			readonly item: readonly Item[];
	  }
	| {
			readonly kind: "chance";
			readonly chance: number;
			readonly item: readonly Item[];
	  }
	| {
			readonly kind: "weight";
			readonly selections: ItemDetailQuantityBounds;
			readonly option: readonly {
				readonly weight: number;
				readonly item: readonly Item[];
			}[];
	  };

export interface ItemDetailOutputSet<Item> {
	readonly weight: number;
	readonly roll: readonly ItemDetailOutputRoll<Item>[];
}
