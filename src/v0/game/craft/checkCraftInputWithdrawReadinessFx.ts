import { Effect } from "effect";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { readCraftInputQuantitiesFx } from "~/v0/game/craft/readCraftInputQuantitiesFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftInputWithdraw } from "~/v0/game/action/GameActionCraftInputWithdraw";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkCraftInputWithdrawReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftInputWithdraw;
	}
}

export const checkCraftInputWithdrawReadinessFx = Effect.fn("checkCraftInputWithdrawReadinessFx")(
	function* ({ config, save, action }: checkCraftInputWithdrawReadinessFx.Props) {
		const target = yield* readCraftBoardItemFx({
			config,
			save,
			targetItemInstanceId: action.targetItemInstanceId,
		});
		const runningCraftJob = Object.values(save.craftJobs).find(
			(job) => job.targetItemInstanceId === action.targetItemInstanceId,
		);
		if (runningCraftJob) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"craft_in_progress",
					`Craft target "${action.targetItemInstanceId}" already has running craft job "${runningCraftJob.id}".`,
				),
			);
		}

		const inputSlot = target.recipe.inputs.find((input) => input.itemId === action.itemId);
		if (!inputSlot) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Craft recipe "${target.recipeId}" has no input "${action.itemId}".`,
				),
			);
		}

		const storedInputs = yield* readCraftInputQuantitiesFx({
			save,
			targetItemInstanceId: action.targetItemInstanceId,
		});
		const previousQuantity = storedInputs.get(action.itemId) ?? 0;
		if (previousQuantity < action.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_unavailable",
					`Craft input "${action.itemId}" quantity unavailable (${previousQuantity}/${action.quantity}).`,
				),
			);
		}

		return {
			inputSlot,
			nextQuantity: previousQuantity - action.quantity,
			previousQuantity,
			target,
		};
	},
);
