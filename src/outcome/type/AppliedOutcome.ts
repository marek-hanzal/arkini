import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";

/** Ordered Item/Template effects; Space navigation is projected from the final Runtime difference. */
export type AppliedOutcome = AppliedOutcome.Item | AppliedOutcome.Template;
export namespace AppliedOutcome {
	export interface Item {
		readonly type: "item";
		readonly placement: PlacementPlan;
	}
	export interface Template {
		readonly type: "template";
		readonly space: number;
		readonly templateUid: IdSchema.Type;
		readonly removed: readonly RuntimeItemSchema.Type[];
	}
}
