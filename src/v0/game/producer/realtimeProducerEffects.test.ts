import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";

describe("realtime producer line effects", () => {
	it("computes duration from current nearby board state through output-owned rules", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					output: [
						{
							itemId: "item:twig",
							quantity: 2,
							type: "guaranteed",
							effects: [
								{
									bands: [
										{
											maxDistance: 1,
											minDistance: 0,
											multiplier: 0.5,
										},
									],
									display: "whenActive",
									items: {
										anyOf: [
											{
												ids: [
													"item:axe",
												],
											},
										],
									},
									kind: "nearby.duration.multiply",
									label: "Nearby Axe Haste",
									radius: 1,
								},
							],
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const product = config.products["product:test"];

		expect(
			readEffectiveProducerProductLine({
				baseDurationMs: product.durationMs,
				config,
				producerItemInstanceId: "item-instance:1",
				product,
				productId: "product:test",
				save,
			}).durationMs,
		).toBe(500);
	});
});
