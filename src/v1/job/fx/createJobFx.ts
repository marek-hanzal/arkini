import { Effect } from "effect";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { TimeSchema } from "~/v1/common/schema/TimeSchema";
import type { JobSchema } from "~/v1/job/schema/JobSchema";
import { createJobIdFx } from "./createJobIdFx";
export namespace createJobFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		durationMs: TimeSchema.Type;
	}
}
export const createJobFx = Effect.fn("createJobFx")(function* ({
	ownerItemId,
	lineId,
	durationMs,
}: createJobFx.Props) {
	return {
		id: yield* createJobIdFx(),
		ownerItemId,
		lineId,
		durationMs,
		remainingMs: durationMs,
	} satisfies JobSchema.Type;
});
