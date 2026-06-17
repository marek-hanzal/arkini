import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
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

				if (effect.type === "product.input.quantity.add") {
					const baseInput = baseProduct.inputs.find(
						(input) => input.itemId === effect.itemId,
					);
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
