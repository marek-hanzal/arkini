import { Effect } from "effect";
import { match } from "ts-pattern";

import { InputModeEnumSchema } from "~/engine/input/schema/InputModeEnumSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { applyInputMaterialConsumeRunPlanFx } from "~/engine/input/fx/run/applyInputMaterialConsumeRunPlanFx";
import { applyInputMaterialReserveRunPlanFx } from "~/engine/input/fx/run/applyInputMaterialReserveRunPlanFx";
import type { InputRunPlanSchema } from "~/engine/input/schema/run/InputRunPlanSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

export namespace applyInputRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputRunPlanSchema.Type;
		runtime: RuntimeSchema.Type;
	}

	export interface Result {
		readonly consumption: readonly applyInputMaterialConsumeRunPlanFx.Consumption[];
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Dispatches one exact line input operation and reports any committed consume identities. */
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
				type: InputEnumSchema.enum.Simple,
			},
			() =>
				Effect.succeed({
					consumption: [],
					events: [],
					runtime,
				} satisfies applyInputRunPlanFx.Result),
		)
		.with(
			{
				type: InputEnumSchema.enum.Materials,
				mode: InputModeEnumSchema.enum.Consume,
			},
			(plan) =>
				applyInputMaterialConsumeRunPlanFx({
					jobId,
					ownerItemId,
					lineId,
					inputIndex,
					plan,
					runtime,
				}),
		)
		.with(
			{
				type: InputEnumSchema.enum.Materials,
				mode: InputModeEnumSchema.enum.Reserve,
			},
			(plan) =>
				applyInputMaterialReserveRunPlanFx({
					jobId,
					ownerItemId,
					lineId,
					inputIndex,
					plan,
					runtime,
				}).pipe(
					Effect.map(
						(nextRuntime) =>
							({
								consumption: [],
								events: [],
								runtime: nextRuntime,
							}) satisfies applyInputRunPlanFx.Result,
					),
				),
		)
		.with(
			{
				type: InputEnumSchema.enum.Deposit,
			},
			() =>
				Effect.succeed({
					consumption: [],
					events: [],
					runtime,
				} satisfies applyInputRunPlanFx.Result),
		)
		.exhaustive();
});
