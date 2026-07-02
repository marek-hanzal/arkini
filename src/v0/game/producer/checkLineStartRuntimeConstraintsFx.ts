import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameLineDefinition } from "~/v0/game/config/GameItemCapabilities";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveLine } from "~/v0/game/effects/readEffectiveLine";
import { readLineDurationMs } from "~/v0/game/producer/readLineDurationMs";
import { readEffectiveOutputTargetLimits } from "~/v0/game/limit/readEffectiveOutputTargetLimits";

export namespace checkLineStartRuntimeConstraintsFx {
	export interface Props {
		config: GameConfig;
		itemInstanceId: string;
		line: GameLineDefinition;
		lineId: string;
		save: GameSave;
		startAtMs: number;
	}
}

export const checkLineStartRuntimeConstraintsFx = Effect.fn("checkLineStartRuntimeConstraintsFx")(
	function* ({
		config,
		itemInstanceId,
		line,
		lineId,
		save,
		startAtMs,
	}: checkLineStartRuntimeConstraintsFx.Props) {
		const effectiveLine = readEffectiveLine({
			baseDurationMs: readLineDurationMs({
				line,
			}),
			config,
			nowMs: startAtMs,
			itemInstanceId,
			line,
			lineId,
			save,
		});

		if (!effectiveLine.visible) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"invalid_actor",
					`Line "${lineId}" is hidden by an active effect at its scheduled start.`,
				),
			);
		}

		if (!effectiveLine.startRequirementsReady) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"effect:missing-grant",
					`Line "${lineId}" is missing effect requirements at its scheduled start.`,
				),
			);
		}

		if (effectiveLine.blocked) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"blocked",
					`Line "${lineId}" is blocked by an active effect at its scheduled start.`,
				),
			);
		}

		if (line.output && effectiveLine.lootPlan.baseOutput.length === 0) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"effect:disabled-output",
					`Line "${lineId}" has no enabled drops at its scheduled start.`,
				),
			);
		}

		const blockedLimit = readEffectiveOutputTargetLimits({
			config,
			includePendingCraftJobs: true,
			includePendingCraftSourceItems: true,
			includePendingProducerJobs: true,
			nowMs: startAtMs,
			lootPlan: effectiveLine.lootPlan,
			save,
		}).find((limit) => limit.remainingQuantity < limit.requiredQuantity);

		if (blockedLimit) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:max-count",
					`Board already has the maximum allowed count for "${blockedLimit.itemId}".`,
				),
			);
		}
	},
);
