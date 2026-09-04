import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { ItemDetailReference } from "~/item-detail-frame/fx/projectItemDetailReferenceFx";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { DistanceSchema } from "~/item-location/schema/DistanceSchema";
import type { ChargeSourceSchema } from "~/production-input/schema/ChargeSourceSchema";
import type { ModeSchema } from "~/production-input/schema/ModeSchema";
import type { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import type { OutputProjection } from "~/production-output/type/OutputProjection";
import type { ItemDetailLines } from "~/item-line-detail/type/ItemDetailLines";

/** Renderer-owned contract for one live Item Detail lines projection. */
export namespace ItemDetailLinesProjection {
	export interface ChargeCost {
		readonly cost: number;
		readonly from: ChargeSourceSchema.Type;
	}

	export interface Selector {
		readonly kind: SelectorSchema.Type["type"];
		readonly label: string;
	}

	export type Input =
		| {
				readonly kind: "materials";
				readonly inputIndex: NonNegativeIntegerSchema.Type;
				readonly selector: Selector;
				readonly mode: ModeSchema.Type;
				readonly required: ItemDetailLines.QuantityBounds;
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
				readonly detail?: ItemDetailReference;
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
				readonly detail?: ItemDetailReference;
		  }
		| {
				readonly kind: "simple";
				readonly count: number;
				readonly ready: boolean;
				readonly charges: ChargeCost;
		  };

	export interface OutputItem extends OutputProjection.Item {
		readonly sourceUrl?: string;
		readonly compositeUrl?: string;
		readonly definitionItemId?: string;
	}

	export type DisabledReason =
		| {
				readonly kind: "owner-stored";
				readonly message: string;
		  }
		| {
				readonly kind: "line-disabled";
				readonly hint: string | undefined;
				readonly message: string;
		  }
		| {
				readonly kind: "deposit-target-missing";
				readonly selector: Selector;
				readonly distance: DistanceSchema.Type;
				readonly detail?: ItemDetailReference;
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
		readonly output: readonly OutputProjection.Set<OutputItem>[];
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
