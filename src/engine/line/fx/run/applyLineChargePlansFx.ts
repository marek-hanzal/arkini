import { Effect } from "effect";

import { settleActionChargesFx } from "~/engine/action/fx/settleActionChargesFx";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { LineRun } from "~/engine/line/LineRun";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyLineChargePlansFx {
	export interface Props {
		job: JobSchema.Type;
		plan: LineRun.Plan;
		runtime: RuntimeSchema.Type;
	}
}

/** Settles the shared action costs reserved by one Line run plan. */
export const applyLineChargePlansFx = Effect.fn("applyLineChargePlansFx")(function* ({
	job,
	plan,
	runtime,
}: applyLineChargePlansFx.Props) {
	return yield* settleActionChargesFx({
		actionId: job.lineId,
		charges: plan.input.flatMap(({ charges }) =>
			charges === undefined
				? []
				: [
						charges,
					],
		),
		ownerItemId: job.ownerItemId,
		runtime,
	});
});
