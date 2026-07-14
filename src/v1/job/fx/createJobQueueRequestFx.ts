import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { JobQueueRequestSchema } from "~/v1/job/schema/JobQueueRequestSchema";
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
	} satisfies JobQueueRequestSchema.Type;
});
