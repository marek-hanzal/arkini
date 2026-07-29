import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";

/** Captured renderer intent shared by drop preview and authoritative commit dispatch. */
export interface DropItemCommand {
	readonly sourceItemId: IdSchema.Type;
	readonly sourceRevision: RevisionSchema.Type;
	readonly sourceLocation: GridLocationSchema.Type;
	readonly target:
		| {
				readonly kind: "slot";
				readonly hitLocation?: GridLocationSchema.Type;
				readonly location: GridLocationSchema.Type;
				readonly occupant: {
					readonly itemId: IdSchema.Type;
					readonly revision: RevisionSchema.Type;
				} | null;
				readonly expectedCollisions?: ReadonlyArray<{
					readonly itemId: IdSchema.Type;
					readonly revision: RevisionSchema.Type;
				}>;
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
