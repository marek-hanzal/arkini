import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";

export namespace readProducerJobEffectiveProductLineFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		nowMs: number;
		producerItemInstanceId: string;
		productId: string;
		save: GameSave;
	}
}

export const readProducerJobEffectiveProductLineFx = Effect.fn(
	"readProducerJobEffectiveProductLineFx",
)(function* ({
	config,
	ignoredProducerJobIds,
	nowMs,
	producerItemInstanceId,
	productId,
	save,
}: readProducerJobEffectiveProductLineFx.Props) {
	const producerItem = save.board.items[producerItemInstanceId];
	if (!producerItem) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Producer job target "${producerItemInstanceId}" must be a board item.`,
			),
		);
	}

	const producerDefinition = readProducerCapabilityDefinition({
		config,
		producerId: producerItem.itemId,
	});
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing producer-like capability definition "${producerItem.itemId}".`,
			),
		);
	}
	if (!producerDefinition.productIds.includes(productId)) {
		return yield* Effect.fail(
			GameEngineError.saveInvalid(
				`Product "${productId}" does not belong to producer-like capability "${producerItem.itemId}".`,
			),
		);
	}

	const product = config.products[productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${productId}".`),
		);
	}

	return readEffectiveProducerProductLine({
		baseDurationMs: readProducerProductDurationMs({
			product,
		}),
		config,
		ignoredProducerJobIds,
		nowMs,
		producerId: producerItem.itemId,
		producerItemId: producerItem.itemId,
		producerItemInstanceId,
		product,
		productId,
		save,
	});
});
