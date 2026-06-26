import { Effect } from "effect";
import { checkItemMergeReadinessFx } from "~/v0/game/merge/checkItemMergeReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import { consumeActivationInputsFx } from "~/v0/game/requirements/consumeActivationInputsFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionItemMerge } from "~/v0/game/action/GameActionItemMerge";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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

	yield* checkItemCreateBlockedByEffectsFx({
		config,
		itemId: checked.merge.resultItemId,
		nowMs,
		save: nextSave,
		targetCell: liveTarget,
	});

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
				replacedAtMs: nowMs,
				toItemId: checked.merge.resultItemId,
				type: "item.replaced" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			nowMs,
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
