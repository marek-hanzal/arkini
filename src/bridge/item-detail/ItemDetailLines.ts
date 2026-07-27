import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import type { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import type { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import type { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import type {
	ItemDetailOutputRoll,
	ItemDetailOutputSet,
	ItemDetailQuantityBounds,
} from "~/engine/item-detail/read/ItemDetailOutput";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";

/** Renderer-owned contract for one live Item Detail lines projection. */
export namespace ItemDetailLines {
	export type QuantityBounds = ItemDetailQuantityBounds;

	export interface ChargeCost {
		readonly cost: number;
		readonly from: InputChargeFromEnumSchema.Type;
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
				readonly selector: Selector;
				readonly mode: InputModeEnumSchema.Type;
				readonly required: QuantityBounds;
				readonly storedQuantity: number;
				readonly maxStoredQuantity: number;
				readonly missingQuantity: number;
				readonly availableCapacity: number;
				readonly ready: boolean;
				readonly storedItems?: readonly {
					readonly compositeUrl?: string;
					readonly itemId: string;
					readonly quantity: number;
					readonly revision: string;
					readonly runtimeItemId: string;
					readonly sourceUrl?: string;
					readonly title: string;
				}[];
				readonly charges?: ChargeCost;
				readonly detail?: DetailReference;
		  }
		| {
				readonly kind: "deposit";
				readonly selector: Selector;
				readonly distance: "close" | "near" | "far";
				readonly requiredCharges: number;
				readonly availableCharges: number;
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
		readonly sourceUrl?: string;
		readonly compositeUrl?: string;
		readonly definitionItemId?: string;
	}

	export type OutputRoll = ItemDetailOutputRoll<OutputItem>;
	export type OutputSet = ItemDetailOutputSet<OutputItem>;

	export type Availability = readItemDetailLinesFx.Availability;

	export interface Line {
		readonly lineId: string;
		readonly title: string;
		readonly description: string;
		readonly baseRuntimeMs: number;
		readonly effectiveRuntimeMs: number;
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
			readonly durationMs: number;
			readonly remainingMs: number;
		};
	}

	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly line: readonly Line[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}
