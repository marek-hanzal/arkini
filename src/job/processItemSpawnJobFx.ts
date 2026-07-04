import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import { readBoardItemCellFx } from "~/board/logic/readBoardItemCellFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveItemSpawnJob } from "~/engine/model/GameSaveSchema";
import { isGamePlacementFailureRetryable } from "~/placement/isGamePlacementFailureRetryable";
import type { GamePlacementFailureReason } from "~/placement/GamePlacementFailureReasonSchema";
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

class ItemSpawnJobProcessingScopeFx extends Context.Tag("ItemSpawnJobProcessingScopeFx")<
	ItemSpawnJobProcessingScopeFx,
	processItemSpawnJobFx.Props
>() {
	//
}

const readItemSpawnSeedCellFx = Effect.fn("processItemSpawnJobFx.readItemSpawnSeedCellFx")(
	function* () {
		const { itemSpawnJob, save } = yield* ItemSpawnJobProcessingScopeFx;
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
)(function* () {
	const { config, itemSpawnJob, nowMs, save } = yield* ItemSpawnJobProcessingScopeFx;
	return yield* Effect.either(
		placeGameSaveItemsFx({
			config,
			items: [
				{
					itemId: itemSpawnJob.itemId,
					originItemInstanceId: itemSpawnJob.originItemInstanceId,
					quantity: itemSpawnJob.quantity,
					reason: itemSpawnJob.reason,
				},
			],
			nowMs,
			save,
			seedCell: yield* readItemSpawnSeedCellFx(),
		}),
	);
});

const completeFailedItemSpawnJobFx = Effect.fn(
	"processItemSpawnJobFx.completeFailedItemSpawnJobFx",
)(function* ({ reason }: { reason: GamePlacementFailureReason }) {
	const { itemSpawnJob, nowMs, save } = yield* ItemSpawnJobProcessingScopeFx;
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	delete nextSave.itemSpawnJobs[itemSpawnJob.id];
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			{
				atMs: nowMs,
				itemId: itemSpawnJob.itemId,
				reason,
				jobId: itemSpawnJob.id,
				type: "item.spawn.failed" as const,
			},
		],
		save: nextSave,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});

const blockItemSpawnJobFx = Effect.fn("processItemSpawnJobFx.blockItemSpawnJobFx")(function* ({
	reason,
}: {
	reason: GamePlacementFailureReason;
}) {
	const { itemSpawnJob, nowMs, save } = yield* ItemSpawnJobProcessingScopeFx;
	return {
		events: [
			{
				atMs: nowMs,
				itemId: itemSpawnJob.itemId,
				reason,
				jobId: itemSpawnJob.id,
				type: "item.spawn.blocked" as const,
			},
		],
		save,
		type: "blocked" as const,
	} satisfies GameEngineCompletionResult;
});

const handleItemSpawnPlacementFailureFx = Effect.fn(
	"processItemSpawnJobFx.handleItemSpawnPlacementFailureFx",
)(function* ({ error }: { error: GameEngineError }) {
	return yield* match(error)
		.with(
			{
				_tag: "GamePlacementFailed",
			},
			({ reason }) =>
				isGamePlacementFailureRetryable(reason)
					? blockItemSpawnJobFx({
							reason,
						})
					: completeFailedItemSpawnJobFx({
							reason,
						}),
		)
		.otherwise((unhandledError) => Effect.fail(unhandledError));
});

const completePlacedItemSpawnJobFx = Effect.fn(
	"processItemSpawnJobFx.completePlacedItemSpawnJobFx",
)(function* ({
	placement,
}: {
	placement: Effect.Effect.Success<ReturnType<typeof placeGameSaveItemsFx>>;
}) {
	const { itemSpawnJob, nowMs } = yield* ItemSpawnJobProcessingScopeFx;
	delete placement.save.itemSpawnJobs[itemSpawnJob.id];
	placement.save.updatedAtMs = nowMs;

	return {
		events: placement.events.map((event) =>
			event.type === "item.created"
				? {
						...event,
						spawnJobId: itemSpawnJob.id,
						spawnSequenceIndex: itemSpawnJob.sequenceIndex,
					}
				: event,
		),
		save: placement.save,
		type: "completed" as const,
	} satisfies GameEngineCompletionResult;
});

const processItemSpawnPlacementResultFx = Effect.fn(
	"processItemSpawnJobFx.processItemSpawnPlacementResultFx",
)(function* () {
	const placementEither = yield* readItemSpawnPlacementEitherFx();
	return yield* match(placementEither)
		.with(
			{
				_tag: "Left",
			},
			({ left }) =>
				handleItemSpawnPlacementFailureFx({
					error: left,
				}),
		)
		.with(
			{
				_tag: "Right",
			},
			({ right }) =>
				completePlacedItemSpawnJobFx({
					placement: right,
				}),
		)
		.exhaustive();
});

export const processItemSpawnJobFx = Effect.fn("processItemSpawnJobFx")(function* (
	props: processItemSpawnJobFx.Props,
) {
	return yield* processItemSpawnPlacementResultFx().pipe(
		Effect.provideService(ItemSpawnJobProcessingScopeFx, props),
	);
});
