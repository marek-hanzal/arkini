import { Effect } from "effect";
import { match } from "ts-pattern";

import { ModeSchema } from "~/production-input/schema/ModeSchema";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import { applyInputMaterialConsumeRunPlanFx } from "~/production-input/fx/applyInputMaterialConsumeRunPlanFx";
import { applyInputMaterialReserveRunPlanFx } from "~/production-input/fx/applyInputMaterialReserveRunPlanFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";

export namespace applyInputRunPlanFx {
	export interface Props {
		jobId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		plan: InputRun.Plan;
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
				type: TypeSchema.enum.Simple,
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
				type: TypeSchema.enum.Materials,
				mode: ModeSchema.enum.Consume,
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
				type: TypeSchema.enum.Materials,
				mode: ModeSchema.enum.Reserve,
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
				type: TypeSchema.enum.Deposit,
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
