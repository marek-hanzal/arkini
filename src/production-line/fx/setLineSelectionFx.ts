import { ItemProductionControlUnavailableError } from "~/production-line/error/ItemProductionControlUnavailableError";
import { createRevisionFx } from "~/item-revision/fx/createRevisionFx";
import { Effect, Option } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";

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
			const selectedLineUids = match(props)
				.with(
					{
						selection: "clock",
					},
					() => lineUids,
				)
				.with(
					{
						selection: "default",
						lineUid: null,
					},
					() => [],
				)
				.with(
					{
						selection: "default",
						lineUid: P.string,
					},
					({ lineUid }) => [
						lineUid,
					],
				)
				.exhaustive();
			const invalidLineUid = selectedLineUids.find(
				(id) => lines?.some((line) => line.uid === id) !== true,
			);
			if (invalidLineUid !== undefined) {
				return yield* Effect.fail(
					new LineNotFoundError({
						itemId: ownerItemId,
						lineUid: invalidLineUid,
					}),
				);
			}
			const wrongRole = selectedLineUids.find((id) => {
				const line = lines?.find((candidate) => candidate.uid === id);
				return line?.clock === LineClockModeEnumSchema.enum["clock-lifetime"];
			});
			if (wrongRole !== undefined)
				return yield* Effect.fail(
					new LineRunUnavailableError({
						ownerItemId,
						lineUid: wrongRole,
					}),
				);
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
			const unchanged = match(selection)
				.with("default", () => {
					const current = Object.hasOwn(runtime.defaultLineByOwnerItemId, ownerItemId)
						? runtime.defaultLineByOwnerItemId[ownerItemId]
						: undefined;
					return current === lineUid;
				})
				.with("clock", () => {
					const current = schedule?.lineUids;
					return (
						Array.isArray(current) &&
						current.length === lineUids.length &&
						current.every((id, index) => id === lineUids[index])
					);
				})
				.exhaustive();
			if (unchanged)
				return [
					props,
					runtime,
				] as const;
			const revision = selection === "clock" ? yield* createRevisionFx() : owner.revision;
			const selectedRuntime = match(selection)
				.returnType<RuntimeSchema.Type>()
				.with("default", () => ({
					...runtime,
					defaultLineByOwnerItemId: {
						...runtime.defaultLineByOwnerItemId,
						[ownerItemId]: lineUid,
					},
				}))
				.with("clock", () => {
					if (schedule === undefined)
						return {
							...runtime,
						};
					return {
						...runtime,
						items: runtime.items.map((item) =>
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
						),
					};
				})
				.exhaustive();
			return [
				props,
				selectedRuntime,
			] as const;
		}),
	);
});
