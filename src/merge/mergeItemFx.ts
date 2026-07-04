import { Effect } from "effect";
import { checkItemMergeReadinessFx } from "~/merge/checkItemMergeReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/board/logic/removeBoardItemRuntimeState";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import { readBoardItemCell } from "~/board/logic/readBoardItemCell";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import { rollLootTableItemsFx } from "~/loot/rollLootTableItemsFx";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionItemMergeSchema } from "~/action/GameActionItemMergeSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSaveItemPlacementRequest } from "~/placement/GameSaveItemPlacementRequest";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace mergeItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionItemMergeSchema.Type;
		nowMs: number;
	}
}

export const mergeItemFx = Effect.fn("mergeItemFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: mergeItemFx.Props) {
	const checked = yield* checkItemMergeReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
	const consumed = yield* consumeActivationInputsFx({
		inputRefs: [
			action.sourceRef,
		],
		inputs: [
			{
				consume: true,
				itemId: checked.source.itemId,
				quantity: 1,
			},
		],
		nowMs,
		reason: "merge-source",
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	const liveTarget = nextSave.board.items[checked.target.id];
	if (!liveTarget) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_merge", "Merge target disappeared."),
		);
	}

	const mergeEvents: GameEvent[] = [
		...consumed.events,
	];
	if ("resultItemId" in checked.merge) {
		if (config.items[checked.merge.resultItemId]?.effects?.length) {
			liveTarget.createdAtMs = nowMs;
		} else {
			delete liveTarget.createdAtMs;
		}
		liveTarget.itemId = checked.merge.resultItemId;
		removeBoardItemRuntimeState({
			itemInstanceId: checked.target.id,
			save: nextSave,
		});
		mergeEvents.push({
			fromItemId: checked.target.itemId,
			itemInstanceId: checked.target.id,
			reason: "merge-result" as const,
			atMs: nowMs,
			toItemId: checked.merge.resultItemId,
			type: "item.replaced" as const,
		});
	}

	const seedCell = readBoardItemCell({
		itemInstanceId: checked.target.id,
		save: nextSave,
	});
	const rolledOutput = checked.merge.output
		? yield* rollLootTableItemsFx({
				lootTable: {
					name: `Merge ${checked.source.itemId} + ${checked.target.itemId}`,
					output: checked.merge.output,
				},
			})
		: {
				items: [],
			};
	const placementRequests = rolledOutput.items.map(
		(item) =>
			({
				...item,
				originItemInstanceId: checked.target.id,
				reason: "merge-output",
			}) satisfies GameSaveItemPlacementRequest,
	);
	const sourceFreedBoardItemInstanceIds =
		checked.source.kind === "board"
			? new Set([
					checked.source.itemInstanceId,
				])
			: undefined;
	const placed = placementRequests.length
		? yield* placeGameSaveItemsFx({
				config,
				freedBoardItemInstanceIds: sourceFreedBoardItemInstanceIds,
				items: placementRequests,
				nowMs,
				save: nextSave,
				seedCell,
			})
		: {
				events: [] satisfies GameEvent[],
				save: nextSave,
			};
	placed.save.updatedAtMs = nowMs;

	return {
		events: [
			...mergeEvents,
			...placed.events,
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: placed.save,
		}),
		save: placed.save,
	} satisfies GameEngineResult;
});
