import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { readProductInputs } from "~/v0/game/config/readProductInputs";
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
					inputRefId: productLayer.inputRefId ?? product.inputRefId,
					outputTableId: productLayer.outputTableId ?? product.outputTableId,
				},
			];
		}),
	);

	const inputs = Object.fromEntries(
		Object.entries(config.inputs).map(([inputRefId, inputDefinition]) => [
			inputRefId,
			{
				...inputDefinition,
				inputs: inputDefinition.inputs.map((input) => ({
					...input,
					quantity:
						Object.entries(layer.products).find(([productId, productLayer]) => {
							const layeredProduct = products[productId];
							return (
								layeredProduct?.inputRefId === inputRefId &&
								productLayer.inputs?.[input.itemId]
							);
						})?.[1].inputs?.[input.itemId]?.quantity ?? input.quantity,
				})),
			},
		]),
	);

	return {
		...config,
		inputs,
		producers,
		products,
	} satisfies GameConfig;
});
