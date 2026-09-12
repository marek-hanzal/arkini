import { createRevisionFx } from "~/item-revision/fx/createRevisionFx";
import { Effect } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { ItemProductionControlUnavailableError } from "~/production-line/error/ItemProductionControlUnavailableError";

export namespace setItemScheduleRunningFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly running: boolean;
	}
}
/** Pauses future admission and rule evaluation while preserving ordinary accepted production. */
export const setItemScheduleRunningFx = Effect.fn("setItemScheduleRunningFx")(function* ({
	ownerItemId,
	running,
}: setItemScheduleRunningFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});
			yield* assertItemProductionPlayerControlFx({
				ownerItemId,
				runtime,
			});
			const schedule = owner.schedule;
			if (schedule === undefined || schedule.remainingDurationMs === 0)
				return yield* Effect.fail(
					new ItemProductionControlUnavailableError({
						ownerItemId,
						reason: schedule === undefined ? "not-scheduled" : "expired",
					}),
				);
			if (schedule.running === running)
				return [
					undefined,
					runtime,
				] as const;
			const revision = yield* createRevisionFx();
			return [
				undefined,
				{
					...runtime,
					items: runtime.items.map((item) =>
						item.id === ownerItemId
							? {
									...item,
									revision,
									schedule: {
										...schedule,
										running,
									},
								}
							: item,
					),
				},
			] as const;
		}),
	);
});
