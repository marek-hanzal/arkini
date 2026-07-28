import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import type { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type {
	ItemDetailOutputRoll,
	ItemDetailOutputSet,
	ItemDetailQuantityBounds,
} from "~/engine/item-detail/read/ItemDetailOutput";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

interface ItemDetailLineChargeCost {
	readonly cost: number;
	readonly from: InputChargeFromEnumSchema.Type;
}

/** Engine-owned projection contract for the Lines capability of Item Detail. */
export namespace ItemDetailLines {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type QuantityBounds = ItemDetailQuantityBounds;

	export interface MaterialInput {
		readonly kind: "materials";
		readonly inputIndex: NonNegativeIntegerSchema.Type;
		readonly selector: SelectorSchema.Type;
		readonly mode: InputModeEnumSchema.Type;
		readonly required: QuantityBounds;
		readonly storedQuantity: number;
		readonly deliveryQuantity: number;
		readonly autofillAvailableQuantity: number;
		readonly producerItemId?: IdSchema.Type;
		readonly maxStoredQuantity: number;
		readonly missingQuantity: number;
		readonly availableCapacity: number;
		readonly ready: boolean;
		readonly canWithdraw: boolean;
		readonly charges?: ItemDetailLineChargeCost;
	}

	export interface DepositInput {
		readonly kind: "deposit";
		readonly selector: SelectorSchema.Type;
		readonly distance: DistanceEnumSchema.Type;
		readonly requiredCharges: number;
		readonly availableCharges: number;
		readonly targetItemIds: readonly IdSchema.Type[];
		readonly ready: boolean;
		readonly charges?: ItemDetailLineChargeCost;
	}

	export interface SimpleInput {
		readonly kind: "simple";
		readonly count: number;
		readonly ready: boolean;
		readonly charges: ItemDetailLineChargeCost;
	}

	export type Input = MaterialInput | DepositInput | SimpleInput;

	export interface OutputItem {
		readonly itemId: IdSchema.Type;
		readonly quantity: QuantityBounds;
	}

	export type OutputRoll = ItemDetailOutputRoll<OutputItem>;
	export type OutputSet = ItemDetailOutputSet<OutputItem>;

	export type UnavailableReason =
		| {
				readonly kind: "line-disabled";
				readonly cause:
					| {
							readonly kind: "static";
					  }
					| {
							readonly kind: "enable-rule";
							readonly ruleIndex: number;
							readonly whenIndex: number;
							readonly when: WhenSchema.Type;
					  }
					| {
							readonly kind: "disable-rule";
							readonly ruleIndex: number;
							readonly when: readonly WhenSchema.Type[];
					  };
		  }
		| {
				readonly kind: "owner-stored";
		  }
		| {
				readonly kind: "deposit-target-missing";
				readonly selector: SelectorSchema.Type;
				readonly distance: DistanceEnumSchema.Type;
		  }
		| {
				readonly kind: "direct-output-max-count";
				readonly itemId: IdSchema.Type;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
		  }
		| {
				readonly kind: "downstream-output-max-count";
				readonly intermediateItemId: IdSchema.Type;
				readonly itemId: IdSchema.Type;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
		  };

	export type Availability =
		| {
				readonly kind: "available";
				readonly readiness: "ready" | "inputs" | "queue";
		  }
		| {
				readonly kind: "unavailable";
				readonly reason: UnavailableReason;
		  };

	export interface Line {
		readonly lineId: IdSchema.Type;
		readonly title: string;
		readonly description: string;
		readonly baseRuntimeMs: TimeSchema.Type;
		readonly effectiveRuntimeMs: TimeSchema.Type;
		readonly availability: Availability;
		readonly startMode: "start" | "enqueue";
		readonly isDefault: boolean;
		readonly autonomous: {
			readonly enabled: boolean;
			readonly supported: boolean;
		};
		readonly actions: {
			readonly canAutofill: boolean;
			readonly canStart: boolean;
			readonly canWithdraw: boolean;
		};
		readonly input: readonly Input[];
		readonly output: readonly OutputSet[];
		readonly activeJob?: {
			readonly status: JobStatusEnumSchema.Type;
			readonly durationMs: TimeSchema.Type;
			readonly remainingMs: TimeSchema.Type;
		};
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly line: readonly Line[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}
