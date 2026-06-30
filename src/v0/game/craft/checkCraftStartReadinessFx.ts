import { Effect } from "effect";
import { checkCraftTargetIdleFx } from "~/v0/game/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { readCraftLineEffectState } from "~/v0/game/craft/readCraftLineEffectState";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftStart } from "~/v0/game/action/GameActionCraftStart";
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

	const effectState = readCraftLineEffectState({
		config,
		nowMs,
		recipe: target.recipe,
		save,
	});
	if (!effectState.grantsReady) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"effect:missing-grant",
				`Craft recipe "${action.recipeId}" is missing a required effect requirement.`,
			),
		);
	}
	if (effectState.blocked) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"blocked",
				effectState.blockReasons[0] ?? `Craft recipe "${action.recipeId}" is blocked.`,
			),
		);
	}
	return {
		recipe: target.recipe,
		targetItem: target.targetItem,
	};
});
