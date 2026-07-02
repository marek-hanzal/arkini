import { Effect } from "effect";
import { checkItemMergeReadinessFx } from "~/merge/checkItemMergeReadinessFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/board/logic/removeBoardItemRuntimeState";
import { consumeActivationInputsFx } from "~/activation/consumeActivationInputsFx";
import { readNextWakeAtMsFx } from "~/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/config/GameConfigSchema";
import type { GameActionItemMerge } from "~/action/GameActionItemMerge";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace mergeItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionItemMerge;
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
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				fromItemId: checked.target.itemId,
				itemInstanceId: checked.target.id,
				reason: "merge-result" as const,
				atMs: nowMs,
				toItemId: checked.merge.resultItemId,
				type: "item.replaced" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			config,
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
