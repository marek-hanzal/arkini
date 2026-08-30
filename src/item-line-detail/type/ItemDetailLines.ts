import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import type { ChargeSourceSchema } from "~/production-input/schema/ChargeSourceSchema";
import type { ModeSchema } from "~/production-input/schema/ModeSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

interface ItemDetailLineChargeCost {
	readonly cost: number;
	readonly from: ChargeSourceSchema.Type;
}

/** Framework-neutral contract for the Item Line Detail read projection. */
export namespace ItemDetailLines {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface QuantityBounds {
		readonly min: number;
		readonly max: number;
	}

	export type OutputRoll<Item> =
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
				readonly selections: QuantityBounds;
				readonly option: readonly {
					readonly weight: number;
					readonly item: readonly Item[];
				}[];
		  };

	export interface OutputSet<Item> {
		readonly weight: number;
		readonly roll: readonly OutputRoll<Item>[];
	}

	export interface MaterialInput {
		readonly kind: "materials";
		readonly inputIndex: NonNegativeIntegerSchema.Type;
		readonly selector: SelectorSchema.Type;
		readonly mode: ModeSchema.Type;
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
		readonly distance: DistanceSchema.Type;
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
		readonly activeRuleHints: readonly string[];
	}

	export type LineOutputRoll = OutputRoll<OutputItem>;
	export type LineOutputSet = OutputSet<OutputItem>;

	export type UnavailableReason =
		| {
				readonly kind: "line-disabled";
				readonly cause:
					| {
							readonly kind: "static";
					  }
					| {
							readonly kind: "enable-rule";
							readonly hint: string;
							readonly ruleIndex: number;
							readonly whenIndex: number;
							readonly when: WhenSchema.Type;
					  }
					| {
							readonly kind: "disable-rule";
							readonly hint: string;
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
				readonly distance: DistanceSchema.Type;
		  }
		| {
				readonly kind: "direct-output-capacity";
				readonly itemId: IdSchema.Type;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
		  }
		| {
				readonly kind: "downstream-output-capacity";
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
		readonly activeRuleHints: readonly string[];
		readonly isDefault: boolean;
		readonly queuedRequestCount: number;
		readonly actions: {
			readonly enqueue: {
				readonly enabled: boolean;
			};
			readonly canWithdraw: boolean;
		};
		readonly input: readonly Input[];
		readonly output: readonly LineOutputSet[];
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
				readonly focusLineId?: IdSchema.Type;
				readonly line: readonly Line[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}
