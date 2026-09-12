import { ItemProductionControlUnavailableError } from "~/production-line/error/ItemProductionControlUnavailableError";
import { createRevisionFx } from "~/item-revision/fx/createRevisionFx";
import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import { isolateBoardStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateBoardStatefulOwnerTransitionFx";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace setLineSelectionFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type | null;
		readonly selection: "default" | "clock";
	}
}

/** Changes one independent line role atomically, preserving schedule phase and accepted work. */
export const setLineSelectionFx = Effect.fn("setLineSelectionFx")(function* ({
	ownerItemId,
	lineId,
	selection,
}: setLineSelectionFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			yield* assertItemProductionPlayerControlFx({
				ownerItemId,
				runtime,
			});
			const owner = runtime.items.find((item) => item.id === ownerItemId);
			if (owner === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			}
			const ownerItem = Option.getOrUndefined(narrowLineOwnerItemFn(owner.item));
			if (ownerItem === undefined && lineId === null && selection === "default")
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			const lines = ownerItem === undefined ? undefined : readLineOwnerLinesFn(ownerItem);
			if (lineId !== null && lines?.some((line) => line.id === lineId) !== true) {
				return yield* Effect.fail(
					new LineNotFoundError({
						itemId: ownerItemId,
						lineId,
					}),
				);
			}
			const schedule = owner.schedule;
			if (
				selection === "clock" &&
				(schedule === undefined || schedule.remainingDurationMs === 0)
			) {
				return yield* Effect.fail(
					new ItemProductionControlUnavailableError({
						ownerItemId,
						reason: schedule === undefined ? "not-scheduled" : "expired",
					}),
				);
			}
			const current =
				selection === "default"
					? Object.hasOwn(runtime.defaultLineByOwnerItemId, ownerItemId)
						? runtime.defaultLineByOwnerItemId[ownerItemId]
						: undefined
					: schedule?.lineId;
			if (current === lineId)
				return [
					{
						ownerItemId,
						lineId,
						selection,
					},
					runtime,
				] as const;
			const revision = selection === "clock" ? yield* createRevisionFx() : owner.revision;
			const selectedRuntime = {
				...runtime,
				defaultLineByOwnerItemId:
					selection === "default"
						? {
								...runtime.defaultLineByOwnerItemId,
								[ownerItemId]: lineId,
							}
						: runtime.defaultLineByOwnerItemId,
				items:
					selection === "clock" && schedule !== undefined
						? runtime.items.map((item) =>
								item.id === ownerItemId
									? {
											...item,
											revision,
											schedule: {
												...schedule,
												lineId,
											},
										}
									: item,
							)
						: runtime.items,
			} satisfies RuntimeSchema.Type;
			const isolation = yield* isolateBoardStatefulOwnerTransitionFx({
				ownerItemId,
				runtime: selectedRuntime,
			});
			return [
				{
					ownerItemId,
					lineId,
					selection,
				},
				isolation.runtime,
				isolation.events,
			] as const;
		}),
	);
});
