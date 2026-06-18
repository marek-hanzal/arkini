import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
import type { GameConfigLayer } from "~/v0/game/engine/model/GameConfigLayerSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace buildConfigLayerFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
	}
}

export const buildConfigLayerFx = Effect.fn("buildConfigLayerFx")(function* ({
	config,
	save,
}: buildConfigLayerFx.Props) {
	const layer: GameConfigLayer = {
		producers: {},
		products: {},
	};

	for (const [upgradeId, upgrade] of Object.entries(config.upgrades).sort(([left], [right]) =>
		left.localeCompare(right),
	)) {
		const completedTiers = Math.min(
			save.upgrades[upgradeId]?.completedTiers ?? 0,
			upgrade.tiers.length,
		);

		for (const tier of upgrade.tiers.slice(0, completedTiers)) {
			for (const effect of tier.effects) {
				if (effect.type === "producer.maxQueueSize.add") {
					const baseProducer = config.producers[effect.producerId];
					if (!baseProducer) {
						continue;
					}

					const producerLayer = (layer.producers[effect.producerId] ??= {});
					producerLayer.maxQueueSize = Math.max(
						1,
						(producerLayer.maxQueueSize ?? baseProducer.maxQueueSize) + effect.quantity,
					);
					continue;
				}

				const baseProduct = config.products[effect.productId];
				if (!baseProduct) {
					continue;
				}

				const productLayer = (layer.products[effect.productId] ??= {});

				if (effect.type === "product.duration.add") {
					productLayer.durationMs = Math.max(
						0,
						(productLayer.durationMs ?? baseProduct.durationMs) + effect.ms,
					);
				}

				if (effect.type === "product.outputTable.set") {
					productLayer.outputTableId = effect.tableId;
				}

				if (effect.type === "product.inputRef.set") {
					productLayer.inputRefId = effect.inputRefId;
				}

				if (effect.type === "product.input.quantity.add") {
					const effectiveInputRefId = productLayer.inputRefId ?? baseProduct.inputRefId;
					const baseInput = readProductInputs({
						config: {
							...config,
							products: {
								...config.products,
								[effect.productId]: {
									...baseProduct,
									inputRefId: effectiveInputRefId,
								},
							},
						},
						productId: effect.productId,
					}).find((input) => input.itemId === effect.itemId);
					if (!baseInput) {
						continue;
					}

					const inputs = (productLayer.inputs ??= {});
					const inputLayer = (inputs[effect.itemId] ??= {
						quantity: baseInput.quantity,
					});
					inputLayer.quantity = Math.max(0, inputLayer.quantity + effect.quantity);
				}
			}
		}
	}

	return layer;
});
