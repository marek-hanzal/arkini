import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { JobStartSourceEnumSchema } from "~/engine/event/schema/JobStartSourceEnumSchema";
import { autofillLineInputsRuntimeFx } from "~/engine/input/write/autofillLineInputsFx";
import { fillAndStartLineRuntimeFx } from "~/engine/job/fx/fillAndStartLineRuntimeFx";
import type { JobSchema } from "~/engine/job/schema/JobSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";

export namespace fillAndStartLineFx {
	export interface Props {
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
	}

	export type Result =
		| {
				readonly type: "fill-unavailable";
				readonly missingQuantity: number;
		  }
		| {
				readonly type: "filled";
				readonly remainingMissingQuantity: number;
				readonly scheduledQuantity: number;
		  }
		| {
				readonly type: "started";
				readonly filledQuantity: number;
				readonly job: JobSchema.Type;
		  };
}

/** Starts from settled inputs or sends available Autofill material through physical delivery. */
export const fillAndStartLineFx = Effect.fn("fillAndStartLineFx")(function* ({
	lineId,
	ownerItemId,
}: fillAndStartLineFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const result = yield* fillAndStartLineRuntimeFx({
				lineId,
				ownerItemId,
				runtime,
			});
			if (result.type !== "started") {
				if (result.type === "queue-request-unavailable") {
					return yield* Effect.die(
						new Error("Explicit Fill & Start unexpectedly resolved a queue request."),
					);
				}
				const autofill = yield* autofillLineInputsRuntimeFx({
					lineId,
					ownerItemId,
					purpose: {
						kind: "fill-and-try-start",
						lineId,
						ownerItemId,
					},
					runtime,
				});
				if (autofill.result.scheduledQuantity > 0) {
					return [
						{
							type: "filled",
							remainingMissingQuantity: autofill.result.remainingMissingQuantity,
							scheduledQuantity: autofill.result.scheduledQuantity,
						} as fillAndStartLineFx.Result,
						autofill.runtime,
						autofill.events,
					] as const;
				}
				return [
					{
						type: "fill-unavailable",
						missingQuantity: result.missingQuantity,
					} as fillAndStartLineFx.Result,
					runtime,
				] as const;
			}
			return [
				{
					type: "started",
					filledQuantity: result.filledQuantity,
					job: result.job,
				} as fillAndStartLineFx.Result,
				result.runtime,
				[
					{
						type: GameEventEnumSchema.enum.JobStarted,
						jobId: result.job.id,
						ownerItemId: result.job.ownerItemId,
						lineId: result.job.lineId,
						source: JobStartSourceEnumSchema.enum.Explicit,
					},
					...result.events,
				],
			] as const;
		}),
	);
});
