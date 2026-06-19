import { Effect } from "effect";
import { readCraftBoardItemFx } from "~/v0/game/craft/readCraftBoardItemFx";
import { readCraftInputQuantitiesFx } from "~/v0/game/craft/readCraftInputQuantitiesFx";
import { resolveInputRefsFx } from "~/v0/game/engine/fx/resolveInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionCraftInputStore } from "~/v0/game/engine/model/GameActionCraftInputStore";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkCraftInputStoreReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionCraftInputStore;
	}
}

export const checkCraftInputStoreReadinessFx = Effect.fn("checkCraftInputStoreReadinessFx")(
	function* ({ config, save, action }: checkCraftInputStoreReadinessFx.Props) {
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

		const resolvedRefs = yield* resolveInputRefsFx({
			inputRefs: [
				action.inputRef,
			],
			save,
		});
		const resolvedRef = resolvedRefs[0];
		if (!resolvedRef) {
			return yield* Effect.fail(
				GameEngineError.actionRejected("input_unavailable", "Missing craft input."),
			);
		}

		if (
			resolvedRef.kind === "board" &&
			resolvedRef.itemInstanceId === action.targetItemInstanceId
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"invalid_actor",
					"Craft input target cannot store itself.",
				),
			);
		}

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
		const previousQuantity = storedInputs.get(resolvedRef.itemId) ?? 0;
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
