import { Effect } from "effect";
import { checkCraftTargetIdleFx } from "~/craft/checkCraftTargetIdleFx";
import { readCraftBoardItemFx } from "~/craft/readCraftBoardItemFx";
import { readCraftInputQuantitiesFx } from "~/craft/readCraftInputQuantitiesFx";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionCraftInputStoreSchema } from "~/action/GameActionCraftInputStoreSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readGameItemQuantity } from "~/quantity/GameItemQuantityIndex";

export namespace checkCraftInputStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionCraftInputStoreSchema.Type;
	}
}

export const checkCraftInputStoreReadinessFx = Effect.fn("checkCraftInputStoreReadinessFx")(
	function* ({ config, save, action }: checkCraftInputStoreReadinessFx.Props) {
		const target = yield* readCraftBoardItemFx({
			config,
			save,
			targetItemInstanceId: action.targetItemInstanceId,
		});

		yield* checkCraftTargetIdleFx({
			save,
			targetItemInstanceId: action.targetItemInstanceId,
		});

		const resolvedRef = yield* resolveSingleInputRefFx({
			inputRef: action.inputRef,
			missingMessage: "Missing craft input.",
			save,
		});
		yield* assertResolvedInputRefIsNotBoardItemFx({
			inputRef: resolvedRef,
			message: "Craft input target cannot store itself.",
			targetItemInstanceId: action.targetItemInstanceId,
		});

		const inputSlot = target.recipe.inputs.find((input) => input.itemId === resolvedRef.itemId);
		if (!inputSlot) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Craft input "${resolvedRef.itemId}" is not accepted by recipe "${target.recipeId}".`,
				),
			);
		}

		const storedInputs = yield* readCraftInputQuantitiesFx({
			save,
			targetItemInstanceId: action.targetItemInstanceId,
		});
		const previousQuantity = readGameItemQuantity({
			itemId: resolvedRef.itemId,
			quantities: storedInputs,
		});
		const nextQuantity = previousQuantity + resolvedRef.quantity;
		if (nextQuantity > inputSlot.quantity) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Craft input "${resolvedRef.itemId}" capacity exceeded (${nextQuantity}/${inputSlot.quantity}).`,
				),
			);
		}

		return {
			inputSlot,
			nextQuantity,
			previousQuantity,
			resolvedRef,
			target,
		};
	},
);
