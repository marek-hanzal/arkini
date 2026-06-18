import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameConfigLayer } from "~/v0/game/engine/model/GameConfigLayerSchema";

export namespace applyConfigLayerFx {
	export interface Props {
		config: GameConfig;
		layer: GameConfigLayer;
	}
}

export const applyConfigLayerFx = Effect.fn("applyConfigLayerFx")(function* ({
	config,
	layer,
}: applyConfigLayerFx.Props) {
	const producers = Object.fromEntries(
		Object.entries(config.producers).map(([producerId, producer]) => {
			const producerLayer = layer.producers[producerId];
			if (!producerLayer) {
				return [
					producerId,
					producer,
				];
			}

			return [
				producerId,
				{
					...producer,
					maxQueueSize: producerLayer.maxQueueSize ?? producer.maxQueueSize,
				},
			];
		}),
	);

	const products = Object.fromEntries(
		Object.entries(config.products).map(([productId, product]) => {
			const productLayer = layer.products[productId];
			if (!productLayer) {
				return [
					productId,
					product,
				];
			}

			return [
				productId,
				{
					...product,
					durationMs: productLayer.durationMs ?? product.durationMs,
					inputs: product.inputs
						.map((input) => ({
							...input,
							quantity:
								productLayer.inputs?.[input.itemId]?.quantity ?? input.quantity,
						}))
						.filter((input) => input.quantity > 0),
					outputTableId: productLayer.outputTableId ?? product.outputTableId,
				},
			];
		}),
	);

	return {
		...config,
		producers,
		products,
	} satisfies GameConfig;
});
