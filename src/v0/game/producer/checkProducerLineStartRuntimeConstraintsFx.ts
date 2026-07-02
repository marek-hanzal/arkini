import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerLine } from "~/v0/game/effects/readEffectiveProducerLine";
import { readProducerLineDurationMs } from "~/v0/game/producer/readProducerLineDurationMs";
import { readEffectiveOutputTargetLimits } from "~/v0/game/limit/readEffectiveOutputTargetLimits";

export namespace checkProducerLineStartRuntimeConstraintsFx {
	export interface Props {
		config: GameConfig;
		producerItemInstanceId: string;
		line: GameProducerLineDefinition;
		lineId: string;
		save: GameSave;
		startAtMs: number;
	}
}

export const checkProducerLineStartRuntimeConstraintsFx = Effect.fn(
	"checkProducerLineStartRuntimeConstraintsFx",
)(function* ({
	config,
	producerItemInstanceId,
	line,
	lineId,
	save,
	startAtMs,
}: checkProducerLineStartRuntimeConstraintsFx.Props) {
	const effectiveProducerLine = readEffectiveProducerLine({
		baseDurationMs: readProducerLineDurationMs({
			line,
		}),
		config,
		nowMs: startAtMs,
		producerItemInstanceId,
		line,
		lineId,
		save,
	});

	if (!effectiveProducerLine.visible) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Line "${lineId}" is hidden by an active effect at its scheduled start.`,
			),
		);
	}

	if (!effectiveProducerLine.startRequirementsReady) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"effect:missing-grant",
				`Line "${lineId}" is missing effect requirements at its scheduled start.`,
			),
		);
	}

	if (effectiveProducerLine.blocked) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"blocked",
				`Line "${lineId}" is blocked by an active effect at its scheduled start.`,
			),
		);
	}

	if (line.output && effectiveProducerLine.lootPlan.baseOutput.length === 0) {
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
		lootPlan: effectiveProducerLine.lootPlan,
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
});
