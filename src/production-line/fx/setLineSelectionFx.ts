import { ItemProductionControlUnavailableError } from "~/production-line/error/ItemProductionControlUnavailableError";
import { createRevisionFx } from "~/item-revision/fx/createRevisionFx";
import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace setLineSelectionFx {
	export type Props = {
		readonly ownerItemId: IdSchema.Type;
	} & (
		| {
				readonly selection: "default";
				readonly lineUid: IdSchema.Type | null;
		  }
		| {
				readonly selection: "clock";
				readonly lineUids: readonly IdSchema.Type[];
		  }
	);
}

/** Changes one independent line role atomically, preserving schedule phase and accepted work. */
export const setLineSelectionFx = Effect.fn("setLineSelectionFx")(function* (
	props: setLineSelectionFx.Props,
) {
	const { ownerItemId, selection } = props;
	const lineUids =
		props.selection === "clock"
			? [
					...new Set(props.lineUids),
				]
			: [];
	const lineUid = props.selection === "default" ? props.lineUid : null;
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
			if (ownerItem === undefined && lineUid === null && selection === "default")
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: ownerItemId,
					}),
				);
			const lines = ownerItem === undefined ? undefined : ownerItem.lines;
			const invalidLineUid = (
				selection === "clock"
					? lineUids
					: lineUid === null
						? []
						: [
								lineUid,
							]
			).find((id) => lines?.some((line) => line.uid === id) !== true);
			if (invalidLineUid !== undefined) {
				return yield* Effect.fail(
					new LineNotFoundError({
						itemId: ownerItemId,
						lineUid: invalidLineUid,
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
					: schedule?.lineUids;
			if (
				selection === "default"
					? current === lineUid
					: Array.isArray(current) &&
						current.length === lineUids.length &&
						current.every((id, index) => id === lineUids[index])
			)
				return [
					props,
					runtime,
				] as const;
			const revision = selection === "clock" ? yield* createRevisionFx() : owner.revision;
			const selectedRuntime = {
				...runtime,
				defaultLineByOwnerItemId:
					selection === "default"
						? {
								...runtime.defaultLineByOwnerItemId,
								[ownerItemId]: lineUid,
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
												lineUids,
											},
										}
									: item,
							)
						: runtime.items,
			} satisfies RuntimeSchema.Type;
			return [
				props,
				selectedRuntime,
			] as const;
		}),
	);
});
