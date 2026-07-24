import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { DistanceEnumSchema } from "~/engine/distance/schema/DistanceEnumSchema";
import type { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

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

	export interface QuantityBounds {
		readonly min: number;
		readonly max: number;
	}

	export interface MaterialInput {
		readonly kind: "materials";
		readonly selector: SelectorSchema.Type;
		readonly mode: InputModeEnumSchema.Type;
		readonly required: QuantityBounds;
		readonly storedQuantity: number;
		readonly maxStoredQuantity: number;
		readonly missingQuantity: number;
		readonly availableCapacity: number;
		readonly ready: boolean;
		readonly charges?: ItemDetailLineChargeCost;
	}

	export interface DepositInput {
		readonly kind: "deposit";
		readonly selector: SelectorSchema.Type;
		readonly distance: DistanceEnumSchema.Type;
		readonly requiredTargets: number;
		readonly readyTargets: number;
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

	export type OutputRoll =
		| {
				readonly kind: "guaranteed";
				readonly item: readonly OutputItem[];
		  }
		| {
				readonly kind: "chance";
				readonly chance: number;
				readonly item: readonly OutputItem[];
		  }
		| {
				readonly kind: "weight";
				readonly selections: QuantityBounds;
				readonly option: readonly {
					readonly weight: number;
					readonly item: readonly OutputItem[];
				}[];
		  };

	export interface OutputSet {
		readonly weight: number;
		readonly roll: readonly OutputRoll[];
	}

	export type Availability =
		| {
				readonly kind: "ready";
		  }
		| {
				readonly kind: "blocked";
				readonly reason: "disabled" | "inputs" | "queue" | "stored";
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
		readonly actions: {
			readonly canAutofill: boolean;
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
