import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";

/** Captured renderer intent shared by drop preview and authoritative commit dispatch. */
export interface DropItemCommand {
	readonly sourceItemId: IdSchema.Type;
	readonly sourceRevision: RevisionSchema.Type;
	readonly sourceLocation: BoardLocationSchema.Type;
	readonly target:
		| {
				readonly kind: "slot";
				readonly location: BoardLocationSchema.Type;
				readonly occupant: {
					readonly itemId: IdSchema.Type;
					readonly revision: RevisionSchema.Type;
				} | null;
				readonly inputStore?: {
					readonly lineId: IdSchema.Type;
					readonly inputIndex: NonNegativeIntegerSchema.Type;
				};
		  }
		| {
				readonly kind: "unsupported";
		  };
}
