import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { DropRuleSchema } from "~/production-output/schema/DropRuleSchema";

/** Shared projection vocabulary for authored output alternatives and rolls. */
export namespace OutputProjection {
	export interface Item {
		readonly itemId: IdSchema.Type;
		readonly title: string;
		readonly quantity: Readonly<QuantitySchema.Type>;
		readonly activeRuleHints: readonly string[];
	}

	export interface AuthoredItem extends Item {
		readonly placement: PlacementSchema.Type;
		readonly rules: readonly DropRuleSchema.Type[];
	}

	export type Roll<Item> =
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
				readonly selections: Readonly<QuantitySchema.Type>;
				readonly option: readonly {
					readonly weight: number;
					readonly item: readonly Item[];
				}[];
		  };

	export interface Set<Item> {
		readonly weight: number;
		readonly roll: readonly Roll<Item>[];
	}
}
