import { Effect } from "effect";

import type { JobSchema } from "~/v1/job/schema/JobSchema";
import type { LineRunPlanSchema } from "~/v1/line/schema/run/LineRunPlanSchema";
import { applyInputRunPlanFx } from "~/v1/input/fx/run/applyInputRunPlanFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace applyLineRunPlanFx {
	export interface Props {
		job: JobSchema.Type;
		plan: LineRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Applies every exact input operation prepared for one active job. */
export const applyLineRunPlanFx = Effect.fn("applyLineRunPlanFx")(function* ({
	job,
	plan,
	runtime,
}: applyLineRunPlanFx.Props) {
	return yield* Effect.reduce(plan.input, runtime, (draft, input, inputIndex) => {
		return applyInputRunPlanFx({
			jobId: job.id,
			ownerItemId: plan.ownerItemId,
			lineId: plan.lineId,
			inputIndex,
			plan: input,
			runtime: draft,
		});
	});
});
