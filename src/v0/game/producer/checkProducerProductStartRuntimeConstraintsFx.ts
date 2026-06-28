import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";

export namespace checkProducerProductStartRuntimeConstraintsFx {
	export interface Props {
		config: GameConfig;
		producerId: string;
		producerItemId: string;
		producerItemInstanceId: string;
		product: GameConfig["products"][string];
		productId: string;
		requirements: readonly GameRequirement[];
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
	requirements,
	save,
	startAtMs,
}: checkProducerProductStartRuntimeConstraintsFx.Props) {
	const storedItems = yield* readStoredRequirementQuantitiesFx({
		save,
		targetItemInstanceId: producerItemInstanceId,
	});
	yield* checkGameRequirementsFx({
		requirements,
		save,
		storedItems,
		targetItemInstanceId: producerItemInstanceId,
	});

	const effectiveProductLine = readEffectiveProducerProductLine({
		baseDurationMs: readProducerProductDurationMs({
			product,
			producerItemInstanceId,
			requirements,
			save,
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

	if (effectiveProductLine.blocked) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"blocked",
				`Product "${productId}" is blocked by an active effect at its scheduled start.`,
			),
		);
	}
});
