import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { OutcomeRuleSchema } from "~/outcome/schema/OutcomeRuleSchema";

/** Shared projection vocabulary for authored outcome alternatives and rolls. */
export namespace OutcomeProjection {
	export interface Item {
		readonly type: "item";
		readonly itemUid: IdSchema.Type;
		readonly title: string;
		readonly quantity: Readonly<QuantitySchema.Type>;
		readonly activeRuleHints: readonly string[];
	}

	export interface AuthoredItem extends Item {
		readonly placement: PlacementSchema.Type;
		readonly rules: readonly OutcomeRuleSchema.Type[];
	}

	export interface Space {
		readonly type: "space";
		readonly space: number;
		readonly activeRuleHints: readonly string[];
		readonly rules?: readonly OutcomeRuleSchema.Type[];
	}

	export interface Template {
		readonly type: "template";
		readonly templateUid: string;
		readonly title?: string;
		readonly activeRuleHints: readonly string[];
		readonly rules?: readonly OutcomeRuleSchema.Type[];
	}

	export type Roll<Item> =
		| {
				readonly kind: "guaranteed";
				readonly outcome: readonly (Item | Space | Template)[];
		  }
		| {
				readonly kind: "chance";
				readonly chance: number;
				readonly outcome: readonly (Item | Space | Template)[];
		  };

	export interface Set<Item> {
		readonly activeRuleHints: readonly string[];
		readonly rules?: readonly OutcomeRuleSchema.Type[];
		readonly weight: number;
		readonly roll: readonly Roll<Item>[];
	}
}
