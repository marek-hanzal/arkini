import { Effect } from "effect";

import type { applyInputMaterialConsumeRunPlanFx } from "~/engine/input/fx/run/applyInputMaterialConsumeRunPlanFx";
import { applyInputRunPlanFx } from "~/engine/input/fx/run/applyInputRunPlanFx";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyLineRunPlanFx {
	export interface Props {
		job: JobSchema.Type;
		plan: LineRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly consumption: readonly applyInputMaterialConsumeRunPlanFx.Consumption[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Applies every exact input operation prepared for one active job. */
export const applyLineRunPlanFx = Effect.fn("applyLineRunPlanFx")(function* ({
	job,
	plan,
	runtime,
}: applyLineRunPlanFx.Props) {
	return yield* Effect.reduce(
		plan.input,
		{
			consumption: [] as applyInputMaterialConsumeRunPlanFx.Consumption[],
			runtime,
		},
		(state, input, inputIndex) =>
			applyInputRunPlanFx({
				jobId: job.id,
				ownerItemId: plan.ownerItemId,
				lineId: plan.lineId,
				inputIndex,
				plan: input,
				runtime: state.runtime,
			}).pipe(
				Effect.map((result) => ({
					consumption: [...state.consumption, ...result.consumption],
					runtime: result.runtime,
				})),
			),
	);
});
