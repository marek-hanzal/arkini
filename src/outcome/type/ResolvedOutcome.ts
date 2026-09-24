import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { PlacementSchema } from "~/item-placement/schema/PlacementSchema";

/** Selected results after chance, availability and quantities resolve; generated destinations bind on application. */
export type ResolvedOutcome =
	| ResolvedOutcome.Item
	| ResolvedOutcome.GeneratedSpace
	| ResolvedOutcome.Space
	| ResolvedOutcome.Template;
export namespace ResolvedOutcome {
	export interface GeneratedSpace {
		readonly type: "generated-space";
		readonly ownerItemId: IdSchema.Type;
		readonly templateUid: IdSchema.Type;
	}
	export interface Template {
		readonly type: "template";
		readonly templateUid: IdSchema.Type;
	}
	export interface Item {
		readonly type: "item";
		readonly itemUid: IdSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
		readonly placement: PlacementSchema.Type;
	}
	export interface Space {
		readonly type: "space";
		readonly space: number;
	}
}
