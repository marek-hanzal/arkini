import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
import { createRevisionFx } from "~/v1/revision/fx/createRevisionFx";
import { createJobIdFx } from "./createJobIdFx";
export namespace createJobQueueRequestFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
	}
}
export const createJobQueueRequestFx = Effect.fn("createJobQueueRequestFx")(function* ({
	ownerItemId,
	lineId,
}: createJobQueueRequestFx.Props) {
	return {
		id: yield* createJobIdFx(),
		ownerItemId,
		lineId,
		revision: yield* createRevisionFx(),
	} satisfies JobQueueRequestSchema.Type;
});
