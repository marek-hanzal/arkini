import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { ModeSchema } from "~/production-input/schema/ModeSchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";

/** Internal readiness and exact mutation plans for one configured line input. */
export namespace InputRun {
	export interface ChargePlan {
		readonly itemId: IdSchema.Type;
		readonly cost: PositiveIntegerSchema.Type;
	}

	export interface ItemPlan {
		readonly itemId: IdSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
	}

	export interface SimplePlan {
		readonly type: "simple";
		readonly charges?: ChargePlan;
	}

	export interface MaterialPlan {
		readonly type: "materials";
		readonly mode: ModeSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
		readonly charges?: ChargePlan;
		readonly item: readonly [
			ItemPlan,
			...ItemPlan[],
		];
	}

	export interface DepositPlan {
		readonly type: "deposit";
		readonly charges: ChargePlan;
	}

	export type Plan = SimplePlan | MaterialPlan | DepositPlan;

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

	export interface DepositResolution {
		readonly type: "deposit";
		readonly ready: boolean;
		readonly targetItemId?: IdSchema.Type;
	}

	export type InputResolution = SimpleResolution | MaterialResolution | DepositResolution;

	export interface Resolution {
		readonly resolution: InputResolution;
		readonly plan?: Plan;
	}
}
