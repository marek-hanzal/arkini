import { Effect } from "effect";
import { match } from "ts-pattern";
import { readBoardItemCellFx } from "~/board/readBoardItemCellFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveItemSpawnJob } from "~/engine/model/GameSaveSchema";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace processItemSpawnJobFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		itemSpawnJob: Extract<
			GameSaveItemSpawnJob,
			{
				type: "item.spawn";
			}
		>;
		nowMs: number;
	}
}

const readItemSpawnSeedCellFx = Effect.fn("processItemSpawnJobFx.readItemSpawnSeedCellFx")(
	function* ({ itemSpawnJob, save }: processItemSpawnJobFx.Props) {
		return (
			itemSpawnJob.seedCell ??
			(yield* readBoardItemCellFx({
				itemInstanceId: itemSpawnJob.originItemInstanceId,
				save,
			}))
		);
	},
);

const readItemSpawnPlacementEitherFx = Effect.fn(
	"processItemSpawnJobFx.readItemSpawnPlacementEitherFx",
)(function* (props: processItemSpawnJobFx.Props) {
	return yield* Effect.either(
		placeGameSaveItemsFx({
			config: props.config,
			items: [
				{
					itemId: props.itemSpawnJob.itemId,
					originItemInstanceId: props.itemSpawnJob.originItemInstanceId,
					quantity: props.itemSpawnJob.quantity,
					reason: props.itemSpawnJob.reason,
				},
			],
			nowMs: props.nowMs,
			save: props.save,
			seedCell: yield* readItemSpawnSeedCellFx(props),
		}),
	);
});

const removeItemSpawnJobFromSaveFx = Effect.fn(
	"processItemSpawnJobFx.removeItemSpawnJobFromSaveFx",
)(function* ({
	itemSpawnJob,
	save,
}: Pick<processItemSpawnJobFx.Props, "itemSpawnJob"> & {
	save: GameSave;
}) {
	delete save.itemSpawnJobs[itemSpawnJob.id];
});

const completeFailedItemSpawnJobFx = Effect.fn(
	"processItemSpawnJobFx.completeFailedItemSpawnJobFx",
)(function* ({
	props,
	reason,
}: {
	props: processItemSpawnJobFx.Props;
	reason: GamePlacementFailureReason;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save: props.save,
	});
	yield* removeItemSpawnJobFromSaveFx({
		itemSpawnJob: props.itemSpawnJob,
		save: nextSave,
	});
	nextSave.updatedAtMs = props.nowMs;

	return {
		events: [
			{
				atMs: props.nowMs,
				itemId: props.itemSpawnJob.itemId,
				reason,
				jobId: props.itemSpawnJob.id,
				type: "item.spawn.failed" as const,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});

const blockItemSpawnJobFx = Effect.fn("processItemSpawnJobFx.blockItemSpawnJobFx")(function* ({
	props,
	reason,
}: {
	props: processItemSpawnJobFx.Props;
	reason: GamePlacementFailureReason;
}) {
	return {
		events: [
			{
				atMs: props.nowMs,
				itemId: props.itemSpawnJob.itemId,
				reason,
				jobId: props.itemSpawnJob.id,
				type: "item.spawn.blocked" as const,
			},
		],
		save: props.save,
		type: "blocked" as const,
	} satisfies GameEngineCompletionResult;
});

const handleItemSpawnPlacementFailureFx = Effect.fn(
	"processItemSpawnJobFx.handleItemSpawnPlacementFailureFx",
)(function* ({ error, props }: { error: GameEngineError; props: processItemSpawnJobFx.Props }) {
	return yield* match(error)
		.with(
			{
				_tag: "GamePlacementFailed",
			},
			({ reason }) =>
				isGamePlacementFailureRetryable(reason)
					? blockItemSpawnJobFx({
							props,
							reason,
						})
					: completeFailedItemSpawnJobFx({
							props,
							reason,
						}),
		)
		.otherwise((unhandledError) => Effect.fail(unhandledError));
});

const completePlacedItemSpawnJobFx = Effect.fn(
	"processItemSpawnJobFx.completePlacedItemSpawnJobFx",
)(function* ({
	placement,
	props,
}: {
	placement: Effect.Effect.Success<ReturnType<typeof placeGameSaveItemsFx>>;
	props: processItemSpawnJobFx.Props;
}) {
	yield* removeItemSpawnJobFromSaveFx({
		itemSpawnJob: props.itemSpawnJob,
		save: placement.save,
	});
	placement.save.updatedAtMs = props.nowMs;

	return {
		events: placement.events.map((event) =>
			event.type === "item.created"
				? {
						...event,
						spawnJobId: props.itemSpawnJob.id,
						spawnSequenceIndex: props.itemSpawnJob.sequenceIndex,
					}
				: event,
		),
		save: placement.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});

export const processItemSpawnJobFx = Effect.fn("processItemSpawnJobFx")(function* (
	props: processItemSpawnJobFx.Props,
) {
	const placementEither = yield* readItemSpawnPlacementEitherFx(props);
	return yield* match(placementEither)
		.with(
			{
				_tag: "Left",
			},
			({ left }) =>
				handleItemSpawnPlacementFailureFx({
					error: left,
					props,
				}),
		)
		.with(
			{
				_tag: "Right",
			},
			({ right }) =>
				completePlacedItemSpawnJobFx({
					placement: right,
					props,
				}),
		)
		.exhaustive();
});
