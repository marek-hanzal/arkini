import { Effect } from "effect";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { checkCraftTargetIdleFx } from "~/v0/game/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/action/GameActionCraftStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkCraftStartReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionCraftStart;
	}
}

export const checkCraftStartReadinessFx = Effect.fn("checkCraftStartReadinessFx")(function* ({
	config,
	nowMs,
	save,
	action,
}: checkCraftStartReadinessFx.Props) {
	const target = yield* readCraftBoardItemFx({
		config,
		recipeId: action.recipeId,
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});

	yield* checkCraftTargetIdleFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});

	const storedRequirementItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		requirements: target.recipe.requirements,
		save,
		storedItems: storedRequirementItems,
		targetItemInstanceId: action.targetItemInstanceId,
	});
	yield* checkItemCreateBlockedByEffectsFx({
		config,
		itemId: target.recipe.resultItemId,
		nowMs,
		save,
	});
	if (
		readBoardItemMaxCountCapacity({
			config,
			ignoredBoardItemInstanceIds: new Set([
				action.targetItemInstanceId,
			]),
			itemId: target.recipe.resultItemId,
			save,
		}) <= 0
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"board:max-count",
				`Board already has the maximum allowed count for "${target.recipe.resultItemId}".`,
			),
		);
	}

	return {
		recipe: target.recipe,
		targetItem: target.targetItem,
	};
});
