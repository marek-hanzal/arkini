import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameConfigLayer } from "~/v0/game/config/GameConfigLayerSchema";

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

	const inputLayerByInputRefId = new Map(
		Object.entries(layer.products).flatMap(([productId, productLayer]) => {
			const inputRefId = products[productId]?.inputRefId;
			if (!inputRefId || !productLayer.inputs) {
				return [];
			}

			return [
				[
					inputRefId,
					productLayer.inputs,
				],
			];
		}),
	);

	const inputs = Object.fromEntries(
		Object.entries(config.inputs).map(([inputRefId, inputDefinition]) => {
			const inputLayer = inputLayerByInputRefId.get(inputRefId);

			return [
				inputRefId,
				{
					...inputDefinition,
					inputs: inputDefinition.inputs.map((input) => ({
						...input,
						quantity: inputLayer?.[input.itemId]?.quantity ?? input.quantity,
					})),
				},
			];
		}),
	);

	return {
		...config,
		inputs,
		producers,
		products,
	} satisfies GameConfig;
});
