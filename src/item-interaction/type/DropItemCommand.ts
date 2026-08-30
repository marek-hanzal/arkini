import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";

/** Captured renderer intent shared by drop preview and authoritative commit dispatch. */
export interface DropItemCommand {
	readonly sourceItemId: IdSchema.Type;
	readonly sourceRevision: RevisionSchema.Type;
	readonly sourceLocation: GridLocationSchema.Type;
	readonly target:
		| {
				readonly kind: "slot";
				readonly location: GridLocationSchema.Type;
				readonly occupant: {
					readonly itemId: IdSchema.Type;
					readonly revision: RevisionSchema.Type;
				} | null;
				readonly inputStore?: {
					readonly lineId: IdSchema.Type;
					readonly inputIndex: NonNegativeIntegerSchema.Type;
					readonly quantity: PositiveIntegerSchema.Type;
				};
		  }
		| {
				readonly kind: "unsupported";
		  };
}
