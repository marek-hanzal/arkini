import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemMergedGameEventSchema } from "~/engine/event/schema/ItemMergedGameEventSchema";
import { commitMergeItemsRuntimeFx } from "~/engine/merge/fx/commitMergeItemsRuntimeFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";

export namespace commitMergeItemsFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
	}

	export interface Result {
		readonly event: ItemMergedGameEventSchema.Type;
		readonly sourceBefore: GridRuntimeItemSchema.Type;
		readonly targetBefore: GridRuntimeItemSchema.Type;
		readonly sourceAfter?: GridRuntimeItemSchema.Type;
		readonly targetAfter?: GridRuntimeItemSchema.Type;
	}
}

/** Commits one directional merge and returns exact before/after actor identities. */
export const commitMergeItemsFx = Effect.fn("commitMergeItemsFx")(function* ({
	sourceItemId,
	sourceRevision,
	targetItemId,
	targetRevision,
}: commitMergeItemsFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const committed = yield* commitMergeItemsRuntimeFx({
				runtime,
				sourceItemId,
				sourceRevision,
				targetItemId,
				targetRevision,
			});
			const result = {
				event: committed.event,
				sourceBefore: committed.sourceBefore,
				targetBefore: committed.targetBefore,
				...(committed.sourceAfter === undefined
					? {}
					: {
							sourceAfter: committed.sourceAfter,
						}),
				...(committed.targetAfter === undefined
					? {}
					: {
							targetAfter: committed.targetAfter,
						}),
			} satisfies commitMergeItemsFx.Result;

			return [
				result,
				committed.runtime,
				committed.events,
			] as const;
		}),
	);
});
