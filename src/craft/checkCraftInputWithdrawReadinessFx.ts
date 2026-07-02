import { Effect } from "effect";
import { checkCraftTargetIdleFx } from "~/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/craft/readCraftBoardItemFx";
import { readCraftInputQuantitiesFx } from "~/craft/readCraftInputQuantitiesFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionCraftInputWithdraw } from "~/action/GameActionCraftInputWithdraw";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

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
		yield* checkCraftTargetIdleFx({
			save,
			targetItemInstanceId: action.targetItemInstanceId,
		});

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
		const previousQuantity = readGameItemQuantity({
			itemId: action.itemId,
			quantities: storedInputs,
		});
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
