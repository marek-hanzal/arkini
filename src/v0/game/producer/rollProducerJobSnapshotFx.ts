import { Effect } from "effect";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { rollEffectiveLootPlanItemsFx } from "~/v0/game/effects/rollEffectiveLootPlanItemsFx";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";

export namespace rollProducerJobSnapshotFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		producerItemInstanceId: string;
		productId: string;
		save: GameSave;
		startAtMs: number;
	}

	export interface Result {
		outputItems: GameSaveProducerJob["outputItems"];
		placement: GameSaveProducerJob["placement"];
		readyAtMs: number;
		startAtMs: number;
	}
}

export const rollProducerJobSnapshotFx = Effect.fn("rollProducerJobSnapshotFx")(function* ({
	config,
	ignoredProducerJobIds,
	producerItemInstanceId,
	productId,
	save,
	startAtMs,
}: rollProducerJobSnapshotFx.Props) {
	const producerItem = save.board.items[producerItemInstanceId];
	if (!producerItem) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Producer job target "${producerItemInstanceId}" must be a board item.`,
			),
		);
	}

	const producerDefinition = config.producers[producerItem.itemId];
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing producer definition "${producerItem.itemId}".`,
			),
		);
	}
	if (!producerDefinition.productIds.includes(productId)) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Product "${productId}" does not belong to producer "${producerItem.itemId}".`,
			),
		);
	}

	const product = config.products[productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${productId}".`),
		);
	}

	const producerRequirements = resolveGameRequirements({
		config,
		requirementIds: producerDefinition.requirementIds,
	});
	const productRequirements = resolveGameRequirements({
		config,
		requirementIds: product.requirementIds,
	});
	const requirements = [
		...producerRequirements,
		...productRequirements,
	];
	const hindrances = [
		...(producerDefinition.hinderedBy ?? []),
		...(product.hinderedBy ?? []),
	];
	const effectiveProductLine = readEffectiveProducerProductLine({
		ignoredProducerJobIds,
		baseDurationMs: readProducerProductDurationMs({
			hindrances,
			product,
			producerItemInstanceId,
			requirements,
			save,
		}),
		config,
		nowMs: startAtMs,
		producerId: producerItem.itemId,
		producerItemId: producerItem.itemId,
		producerItemInstanceId,
		product,
		productId,
		save,
	});
	const outputItems = (yield* rollEffectiveLootPlanItemsFx({
		config,
		lootPlan: effectiveProductLine.lootPlan,
	})).items;

	return {
		outputItems,
		placement: product.placement,
		readyAtMs: startAtMs + effectiveProductLine.durationMs,
		startAtMs,
	} satisfies rollProducerJobSnapshotFx.Result;
});
