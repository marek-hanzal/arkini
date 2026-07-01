import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/v0/game/engine/model/GameSaveSchema";
import { readCraftLineEffectState } from "~/v0/game/craft/readCraftLineEffectState";
import { readItemTargetLimits } from "~/v0/game/limit/readItemTargetLimits";
import { readTargetLimitBlocked } from "~/v0/game/limit/readTargetLimitBlocked";

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
		if (!effectState.startRequirementsReady) {
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

		const targetLimits = readItemTargetLimits({
			config,
			ignoredBoardItemInstanceIds: new Set([
				targetItemInstanceId,
			]),
			includePendingCraftJobs: true,
			includePendingProducerJobs: true,
			nowMs,
			itemId: recipe.resultItemId,
			save,
		});
		if (readTargetLimitBlocked(targetLimits)) {
			const blockedLimit = targetLimits.find(
				(limit) => limit.remainingQuantity < limit.requiredQuantity,
			);
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:max-count",
					`Board already has the maximum allowed count for "${blockedLimit?.itemId ?? recipe.resultItemId}".`,
				),
			);
		}
	},
);
