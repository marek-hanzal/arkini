import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** One exact positive-probability authored drop occurrence inside an output. */
export interface OutputSelectionWitness {
	readonly candidateIndex?: number;
	readonly dropIndex: number;
	readonly itemId: IdSchema.Type;
	readonly rollIndex: number;
	readonly setIndex: number;
}
