import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { InputRunPlanSchema } from "~/v1/input/schema/run/InputRunPlanSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { applyInputMaterialConsumeRunPlanFx } from "./applyInputMaterialConsumeRunPlanFx";
import { applyInputMaterialReserveRunPlanFx } from "./applyInputMaterialReserveRunPlanFx";

export namespace applyInputRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Dispatches one exact line input operation onto an immutable runtime draft. */
export const applyInputRunPlanFx = Effect.fn("applyInputRunPlanFx")(function* ({
	jobId,
	ownerItemId,
	lineId,
	inputIndex,
	plan,
	runtime,
}: applyInputRunPlanFx.Props) {
	return yield* match(plan)
		.with(
			{
				type: "simple",
			},
			() => Effect.succeed(runtime),
		)
		.with(
			{
				type: "materials",
				mode: "consume",
			},
			(plan) => {
				return applyInputMaterialConsumeRunPlanFx({
					jobId,
					ownerItemId,
					lineId,
					inputIndex,
					plan,
					runtime,
				});
			},
		)
		.with(
			{
				type: "materials",
				mode: "reserve",
			},
			(plan) => {
				return applyInputMaterialReserveRunPlanFx({
					jobId,
					ownerItemId,
					lineId,
					inputIndex,
					plan,
					runtime,
				});
			},
		)
		.with(
			{
				type: "deposit",
			},
			() => Effect.succeed(runtime),
		)
		.exhaustive();
});
