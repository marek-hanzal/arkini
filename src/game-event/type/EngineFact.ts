import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";

/** Internal transition facts; only the final Runtime draft can turn them into public events. */
export type EngineFact =
	| GameEventSchema.Type
	| {
			readonly type: "outcome:applied";
			readonly originItemId: IdSchema.Type;
			readonly effects: readonly AppliedOutcome[];
	  }
	| {
			readonly type: "template:applied";
			readonly effect: AppliedOutcome.Template;
	  }
	| {
			readonly type: "lifecycle:settled";
			readonly cause: "depleted" | "expired" | "removed";
			readonly itemId: IdSchema.Type;
			readonly itemUid: IdSchema.Type;
			readonly location: BoardLocationSchema.Type;
			readonly visible: boolean;
			/** Only identities produced by this lifecycle's own outcome count as replacements. */
			readonly replacementItemIds: readonly IdSchema.Type[];
	  }
	| {
			readonly type: "autofill:admitted";
			readonly ownerItemId: IdSchema.Type;
			readonly itemUid: IdSchema.Type;
			readonly lineUid: IdSchema.Type;
			readonly deliveries: readonly {
				readonly id: IdSchema.Type;
				readonly revision: RevisionSchema.Type;
			}[];
	  }
	| {
			readonly type: "job:admitted";
			readonly jobId: IdSchema.Type;
			readonly ownerItemId: IdSchema.Type;
			readonly itemUid: IdSchema.Type;
			readonly lineUid: IdSchema.Type;
	  };
