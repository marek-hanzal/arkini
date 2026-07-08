import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameCraftRecipeDefinition } from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave, GameSaveBoardItem } from "~/engine/model/GameSaveSchema";
import { readCraftLineEffectState } from "~/craft/readCraftLineEffectState";
import { readItemTargetLimits } from "~/limit/readItemTargetLimits";
import { readCraftOutputItemIds } from "~/craft/readCraftRecipeOutput";
import { readTargetLimitBlocked } from "~/limit/readTargetLimitBlocked";

export namespace checkCraftStartRuntimeConstraintsFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		recipe: GameCraftRecipeDefinition;
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

		for (const outputItemId of readCraftOutputItemIds(recipe)) {
			const targetLimits = readItemTargetLimits({
				config,
				ignoredBoardItemInstanceIds: new Set([
					targetItemInstanceId,
				]),
				includePendingCraftJobs: true,
				includePendingProducerJobs: true,
				nowMs,
				itemId: outputItemId,
				save,
			});
			if (!readTargetLimitBlocked(targetLimits)) continue;
			const blockedLimit = targetLimits.find(
				(limit) => limit.remainingQuantity < limit.requiredQuantity,
			);
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:max-count",
					`Board already has the maximum allowed count for "${blockedLimit?.itemId ?? outputItemId}".`,
				),
			);
		}
	},
);
