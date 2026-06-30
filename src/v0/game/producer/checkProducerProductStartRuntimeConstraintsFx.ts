import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readEffectiveOutputTargetLimits } from "~/v0/game/limit/readEffectiveOutputTargetLimits";

export namespace checkProducerProductStartRuntimeConstraintsFx {
	export interface Props {
		config: GameConfig;
		producerId: string;
		producerItemId: string;
		producerItemInstanceId: string;
		product: GameConfig["products"][string];
		productId: string;
		save: GameSave;
		startAtMs: number;
	}
}

export const checkProducerProductStartRuntimeConstraintsFx = Effect.fn(
	"checkProducerProductStartRuntimeConstraintsFx",
)(function* ({
	config,
	producerId,
	producerItemId,
	producerItemInstanceId,
	product,
	productId,
	save,
	startAtMs,
}: checkProducerProductStartRuntimeConstraintsFx.Props) {
	const effectiveProductLine = readEffectiveProducerProductLine({
		baseDurationMs: readProducerProductDurationMs({
			product,
		}),
		config,
		nowMs: startAtMs,
		producerId,
		producerItemId,
		producerItemInstanceId,
		product,
		productId,
		save,
	});

	if (!effectiveProductLine.visible) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${productId}" is hidden by an active effect at its scheduled start.`,
			),
		);
	}

	if (!effectiveProductLine.grantsReady) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"effect:missing-grant",
				`Product "${productId}" is missing effect grants at its scheduled start.`,
			),
		);
	}

	if (effectiveProductLine.blocked) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"blocked",
				`Product "${productId}" is blocked by an active effect at its scheduled start.`,
			),
		);
	}

	const blockedLimit = readEffectiveOutputTargetLimits({
		config,
		lootPlan: effectiveProductLine.lootPlan,
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
