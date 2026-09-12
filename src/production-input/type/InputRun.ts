import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { ModeSchema } from "~/production-input/schema/ModeSchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";

/** Internal readiness and exact mutation plans for one configured line input. */
export namespace InputRun {
	export interface UnitPlan {
		readonly itemId: IdSchema.Type;
		readonly cost: PositiveIntegerSchema.Type;
	}

	export interface ItemPlan {
		readonly itemId: IdSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
	}

	export interface SimplePlan {
		readonly type: "simple";
		readonly units?: UnitPlan;
	}

	export interface MaterialPlan {
		readonly type: "materials";
		readonly mode: ModeSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
		readonly units?: UnitPlan;
		readonly item: readonly [
			ItemPlan,
			...ItemPlan[],
		];
	}

	export interface UnitsPlan {
		readonly type: "units";
		readonly units: UnitPlan;
	}

	export type Plan = SimplePlan | MaterialPlan | UnitsPlan;

	export interface SimpleResolution {
		readonly type: "simple";
		readonly ready: boolean;
	}

	export interface MaterialResolution {
		readonly type: "materials";
		readonly mode: ModeSchema.Type;
		readonly required: QuantitySchema.Type;
		readonly storedQuantity: NonNegativeIntegerSchema.Type;
		readonly maxStoredQuantity: PositiveIntegerSchema.Type;
		readonly runQuantity: NonNegativeIntegerSchema.Type;
		readonly missingQuantity: NonNegativeIntegerSchema.Type;
		readonly availableCapacity: NonNegativeIntegerSchema.Type;
		readonly ready: boolean;
	}

	export interface UnitsResolution {
		readonly type: "units";
		readonly ready: boolean;
		readonly targetItemId?: IdSchema.Type;
	}

	export type InputResolution = SimpleResolution | MaterialResolution | UnitsResolution;

	export interface Resolution {
		readonly resolution: InputResolution;
		readonly plan?: Plan;
	}
}
