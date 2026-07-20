import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemMergedGameEventSchema } from "~/engine/event/schema/ItemMergedGameEventSchema";
import { commitMergeItemsFx } from "~/engine/merge/internal/commitMergeItemsFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";

export namespace mergeItemsFx {
	export interface Props {
		sourceItemId: IdSchema.Type;
		sourceRevision: RevisionSchema.Type;
		targetItemId: IdSchema.Type;
		targetRevision: RevisionSchema.Type;
	}

	export type Result = ItemMergedGameEventSchema.Type;
}

/** Atomically executes one source-owned directional gameplay merge. */
export const mergeItemsFx = Effect.fn("mergeItemsFx")(function* (props: mergeItemsFx.Props) {
	const result = yield* commitMergeItemsFx(props);
	return result.event;
});
