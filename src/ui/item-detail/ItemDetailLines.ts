import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import type { ChargeSourceSchema } from "~/production-input/schema/ChargeSourceSchema";
import type { ModeSchema } from "~/production-input/schema/ModeSchema";
import type { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import type {
	ItemDetailOutputRoll,
	ItemDetailOutputSet,
	ItemDetailQuantityBounds,
} from "~/engine/item-detail/read/ItemDetailOutput";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";

/** Renderer-owned contract for one live Item Detail lines projection. */
export namespace ItemDetailLines {
	export type QuantityBounds = ItemDetailQuantityBounds;

	export interface ChargeCost {
		readonly cost: number;
		readonly from: ChargeSourceSchema.Type;
	}

	export interface Selector {
		readonly kind: SelectorSchema.Type["type"];
		readonly label: string;
	}

	export interface DetailReference {
		readonly itemId: string;
		readonly title: string;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly detailItemId?: string;
	}

	export type Input =
		| {
				readonly kind: "materials";
				readonly inputIndex: NonNegativeIntegerSchema.Type;
				readonly selector: Selector;
				readonly mode: ModeSchema.Type;
				readonly required: QuantityBounds;
				readonly storedQuantity: number;
				readonly deliveryQuantity: number;
				readonly autofillAvailableQuantity: number;
				readonly producerItemId?: string;
				readonly maxStoredQuantity: number;
				readonly missingQuantity: number;
				readonly availableCapacity: number;
				readonly ready: boolean;
				readonly canWithdraw: boolean;
				readonly charges?: ChargeCost;
				readonly detail?: DetailReference;
		  }
		| {
				readonly kind: "deposit";
				readonly selector: Selector;
				readonly distance: DistanceSchema.Type;
				readonly requiredCharges: number;
				readonly availableCharges: number;
				readonly availableChargesLabel: string;
				readonly targetTitles: readonly string[];
				readonly ready: boolean;
				readonly charges?: ChargeCost;
				readonly detail?: DetailReference;
		  }
		| {
				readonly kind: "simple";
				readonly count: number;
				readonly ready: boolean;
				readonly charges: ChargeCost;
		  };

	export interface OutputItem {
		readonly itemId: string;
		readonly title: string;
		readonly quantity: QuantityBounds;
		readonly activeRuleHints: readonly string[];
		readonly sourceUrl?: string;
		readonly compositeUrl?: string;
		readonly definitionItemId?: string;
	}

	export type OutputRoll = ItemDetailOutputRoll<OutputItem>;
	export type OutputSet = ItemDetailOutputSet<OutputItem>;

	interface DisabledConditionContext {
		readonly selector: Selector;
		readonly locationLabel: string;
		readonly detail?: DetailReference;
	}

	export type DisabledCondition = DisabledConditionContext &
		(
			| {
					readonly kind: "exists";
			  }
			| {
					readonly kind: "count";
					readonly count: number;
			  }
			| {
					readonly kind: "range";
					readonly min: number;
					readonly max: number;
			  }
		);

	export type DisabledReason =
		| {
				readonly kind: "owner-stored";
				readonly message: string;
		  }
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
							readonly condition: DisabledCondition;
					  }
					| {
							readonly kind: "disable-rule";
							readonly hint: string;
							readonly ruleIndex: number;
							readonly condition: readonly DisabledCondition[];
					  };
				readonly messageBeforeDetail?: string;
				readonly messageAfterDetail?: string;
				readonly message: string;
		  }
		| {
				readonly kind: "deposit-target-missing";
				readonly selector: Selector;
				readonly distance: DistanceSchema.Type;
				readonly detail?: DetailReference;
				readonly messageBeforeDetail?: string;
				readonly messageAfterDetail?: string;
				readonly message: string;
		  }
		| {
				readonly kind: "direct-output-capacity";
				readonly itemId: string;
				readonly itemTitle: string;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
				readonly messageAfterTitle: string;
				readonly message: string;
		  }
		| {
				readonly kind: "downstream-output-capacity";
				readonly intermediateItemId: string;
				readonly intermediateItemTitle: string;
				readonly itemId: string;
				readonly itemTitle: string;
				readonly liveQuantity: number;
				readonly reservedQuantity: number;
				readonly maxCount: number;
				readonly messageAfterTitle: string;
				readonly message: string;
		  };

	export type Availability =
		| {
				readonly kind: "available";
				readonly readiness: "ready" | "inputs" | "queue";
		  }
		| {
				readonly kind: "unavailable";
				readonly reason: DisabledReason;
		  };

	interface LineActions {
		readonly enqueue: {
			readonly enabled: boolean;
		};
		readonly canWithdraw: boolean;
	}

	interface LineActiveJob {
		readonly status: JobStatusEnumSchema.Type;
		readonly durationMs: number;
		readonly remainingMs: number;
	}

	export interface Line {
		readonly lineId: string;
		readonly title: string;
		readonly description: string;
		readonly baseRuntimeMs: number;
		readonly effectiveRuntimeMs: number;
		readonly availability: Availability;
		readonly activeRuleHints: readonly string[];
		readonly isDefault: boolean;
		readonly queuedRequestCount: number;
		readonly actions: LineActions;
		readonly input: readonly Input[];
		readonly output: readonly OutputSet[];
		readonly activeJob?: LineActiveJob;
	}

	export type Projection =
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
