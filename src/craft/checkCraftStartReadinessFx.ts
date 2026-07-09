import { Effect } from "effect";
import { checkCraftTargetIdleFx } from "~/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/craft/readCraftBoardItemFx";
import { readCraftLineStartGateState } from "~/craft/readCraftLineEffectState";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionCraftStartSchema } from "~/action/GameActionCraftStartSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkCraftStartReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionCraftStartSchema.Type;
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

	const effectState = readCraftLineStartGateState({
		config,
		nowMs,
		recipe: target.recipe,
		save,
	});
	if (!effectState.startRequirementsReady) {
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
