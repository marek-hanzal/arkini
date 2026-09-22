import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { PlacementSchema } from "~/item-placement/schema/PlacementSchema";

/** Concrete results after chance, availability and quantities have resolved. */
export type ResolvedOutcome = ResolvedOutcome.Item | ResolvedOutcome.Space;
export namespace ResolvedOutcome {
	export interface Item {
		readonly type: "item";
		readonly itemId: IdSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
		readonly placement: PlacementSchema.Type;
	}
	export interface Space {
		readonly type: "space";
		readonly space: number;
	}
}
