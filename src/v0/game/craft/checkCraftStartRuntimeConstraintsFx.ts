import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import { readCraftLineEffectState } from "~/v0/game/craft/readCraftLineEffectState";

export namespace checkCraftStartRuntimeConstraintsFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		recipe: GameConfig["craftRecipes"][string];
		save: GameSave;
		targetItem: GameSaveBoardItem;
		targetItemInstanceId: string;
	}
}

export const checkCraftStartRuntimeConstraintsFx = Effect.fn("checkCraftStartRuntimeConstraintsFx")(
	function* ({
		config,
		nowMs,
		recipe,
		save,
		targetItem,
		targetItemInstanceId,
	}: checkCraftStartRuntimeConstraintsFx.Props) {
		const effectState = readCraftLineEffectState({
			config,
			nowMs,
			recipe,
			save,
		});
		if (!effectState.grantsReady) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"effect:missing-grant",
					`Craft recipe for "${targetItem.itemId}" is missing a required effect requirement.`,
				),
			);
		}
		if (effectState.blocked) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"blocked",
					effectState.blockReasons[0] ??
						`Craft recipe for "${targetItem.itemId}" is blocked.`,
				),
			);
		}
		if (
			readBoardItemMaxCountCapacity({
				config,
				ignoredBoardItemInstanceIds: new Set([
					targetItemInstanceId,
				]),
				itemId: recipe.resultItemId,
				save,
			}) <= 0
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:max-count",
					`Board already has the maximum allowed count for "${recipe.resultItemId}".`,
				),
			);
		}
	},
);
