import { Effect } from "effect";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
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
