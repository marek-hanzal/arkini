import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";

const createSaveWithEffectSource = () => {
	const baseConfig = createEngineTestConfig();
	const config = createEngineTestConfig({
		effects: {
			"effect:test": {
				name: "Test effect",
				operations: [
					{
						kind: "line.reveal",
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
					},
					{
						kind: "line.hide",
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
					},
					{
						kind: "line.blockStart",
						reason: "test block",
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
					},
					{
						kind: "duration.addMs",
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
						valueMs: 500,
					},
					{
						kind: "duration.multiply",
						multiplier: 2,
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
					},
					{
						chance: 0.25,
						kind: "loot.appendOutput",
						output: [
							{
								itemId: "item:twig",
								quantity: 1,
								type: "guaranteed",
							},
						],
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
					},
					{
						kind: "loot.addChanceItem",
						chance: 0.5,
						itemId: "item:key",
						quantity: 2,
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
					},
					{
						delta: -0.4,
						kind: "loot.dropChance.add",
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:shred",
										],
									},
								],
							},
						},
					},
				],
				scope: "global",
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:test",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:shred": {
				...baseConfig.products["product:shred"],
				visibility: "hidden",
			},
		},
	});
	const save = runInitialSave({
		config,
		nowMs: 0,
	});
	save.board.items["item-instance:2"] = {
		id: "item-instance:2",
		itemId: "item:axe",
		x: 1,
		y: 0,
	};

	return {
		config,
		save,
	};
};

describe("readEffectiveProducerProductLine", () => {
	it("applies line state, duration, and loot operations without mutating config", () => {
		const { config, save } = createSaveWithEffectSource();
		const product = config.products["product:shred"];

		const effective = readEffectiveProducerProductLine({
			baseDurationMs: product.durationMs,
			config,
			nowMs: 0,
			producerId: "item:producer",
			producerItemId: "item:producer",
			producerItemInstanceId: "item-instance:1",
			product,
			productId: "product:shred",
			save,
		});

		expect(effective.visible).toBe(false);
		expect(effective.blocked).toBe(true);
		expect(effective.blockReasons).toHaveLength(1);
		expect(effective.durationMs).toBe(3000);
		expect(effective.lootPlan).toMatchObject({
			appendOutputs: [
				{
					chance: 0.25,
					output: [
						{
							itemId: "item:twig",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			],
			baseDropChance: 0.6,
			chanceItems: [
				{
					chance: 0.5,
					itemId: "item:key",
					quantity: 2,
				},
			],
		});
		expect(config.products["product:shred"].visibility).toBe("hidden");
	});

	it("allows duration effects to make a producer line instant", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:instant": {
					name: "Instant",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0,
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:instant",
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
				nowMs: 0,
				producerId: "item:producer",
				producerItemId: "item:producer",
				producerItemInstanceId: "item-instance:1",
				product,
				productId: "product:test",
				save,
			}).durationMs,
		).toBe(0);
	});

	it("caps stacked operations by effect category", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:capped-speed": {
					name: "Capped speed",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							stacking: {
								category: "test:speed",
								maxSources: 2,
							},
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					passiveEffectIds: [
						"effect:capped-speed",
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
				],
				inventory: [
					{
						itemId: "item:twig",
						quantity: 3,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const product = config.products["product:test"];

		const effective = readEffectiveProducerProductLine({
			baseDurationMs: product.durationMs,
			config,
			nowMs: 0,
			producerId: "item:producer",
			producerItemId: "item:producer",
			producerItemInstanceId: "item-instance:1",
			product,
			productId: "product:test",
			save,
		});

		expect(effective.durationMs).toBe(250);
		expect(effective.appliedEffects).toHaveLength(2);
	});

	it("applies active effects only between activation and expiration", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:reveal": {
					name: "Reveal while active",
					operations: [
						{
							kind: "line.reveal",
							target: {
								productLines: {
									mode: "all",
								},
							},
						},
					],
					scope: "global",
				},
			},
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					visibility: "hidden",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["active:reveal"] = {
			startAtMs: 1000,
			effectId: "effect:reveal",
			endAtMs: 2000,
			id: "active:reveal",
			sourceItemInstanceId: "item-instance:1",
		};
		const product = config.products["product:shred"];
		const readVisibleAt = (nowMs: number) =>
			readEffectiveProducerProductLine({
				baseDurationMs: product.durationMs,
				config,
				nowMs,
				producerId: "item:producer",
				producerItemId: "item:producer",
				producerItemInstanceId: "item-instance:1",
				product,
				productId: "product:shred",
				save,
			}).visible;

		expect(readVisibleAt(999)).toBe(false);
		expect(readVisibleAt(1000)).toBe(true);
		expect(readVisibleAt(1999)).toBe(true);
		expect(readVisibleAt(2000)).toBe(false);
	});

	it("keeps local effects outside radius from touching the target", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					...baseConfig.game.board,
					width: 3,
				},
			},
			effects: {
				"effect:nearby": {
					name: "Nearby only",
					operations: [
						{
							kind: "line.reveal",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:shred",
											],
										},
									],
								},
							},
						},
					],
					radius: 1,
					scope: "local",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:nearby",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					visibility: "hidden",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:axe",
			x: 2,
			y: 0,
		};
		const product = config.products["product:shred"];

		expect(
			readEffectiveProducerProductLine({
				baseDurationMs: product.durationMs,
				config,
				nowMs: 0,
				producerId: "item:producer",
				producerItemId: "item:producer",
				producerItemInstanceId: "item-instance:1",
				product,
				productId: "product:shred",
				save,
			}).visible,
		).toBe(false);
	});
	it("applies passive global effects from inventory when the effect source scope includes inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:inventory-reveal": {
					name: "Inventory reveal",
					operations: [
						{
							kind: "line.reveal",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:shred",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:inventory-reveal",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					visibility: "hidden",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const product = config.products["product:shred"];

		expect(
			readEffectiveProducerProductLine({
				baseDurationMs: product.durationMs,
				config,
				nowMs: 0,
				producerId: "item:producer",
				producerItemId: "item:producer",
				producerItemInstanceId: "item-instance:1",
				product,
				productId: "product:shred",
				save,
			}).visible,
		).toBe(true);
	});

	it("applies local effects from farthest to nearest so the nearest replace output wins", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			effects: {
				"effect:far-replace": {
					name: "Far replace",
					operations: [
						{
							kind: "loot.replaceOutput",
							output: [
								{
									itemId: "item:plank",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					radius: 5,
					scope: "local",
				},
				"effect:near-replace": {
					name: "Near replace",
					operations: [
						{
							kind: "loot.replaceOutput",
							output: [
								{
									itemId: "item:key",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					radius: 5,
					scope: "local",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:far-replace",
					],
				},
				"item:rock": {
					...baseConfig.items["item:rock"],
					passiveEffectIds: [
						"effect:near-replace",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 2,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 3,
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

		const beforeMove = readEffectiveProducerProductLine({
			baseDurationMs: product.durationMs,
			config,
			nowMs: 0,
			producerId: "item:producer",
			producerItemId: "item:producer",
			producerItemInstanceId: "item-instance:1",
			product,
			productId: "product:test",
			save,
		});
		expect(beforeMove.lootPlan.baseOutput).toMatchObject([
			{
				itemId: "item:key",
			},
		]);

		save.board.items["item-instance:2"] = {
			...save.board.items["item-instance:2"],
			x: 3,
		};
		save.board.items["item-instance:3"] = {
			...save.board.items["item-instance:3"],
			x: 0,
		};

		const afterMove = readEffectiveProducerProductLine({
			baseDurationMs: product.durationMs,
			config,
			nowMs: 0,
			producerId: "item:producer",
			producerItemId: "item:producer",
			producerItemInstanceId: "item-instance:1",
			product,
			productId: "product:test",
			save,
		});
		expect(afterMove.lootPlan.baseOutput).toMatchObject([
			{
				itemId: "item:plank",
			},
		]);
	});

	it("uses source creation time as the tie breaker when local effects have the same proximity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			effects: {
				"effect:older-replace": {
					name: "Older replace",
					operations: [
						{
							kind: "loot.replaceOutput",
							output: [
								{
									itemId: "item:plank",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					radius: 1,
					scope: "local",
				},
				"effect:younger-replace": {
					name: "Younger replace",
					operations: [
						{
							kind: "loot.replaceOutput",
							output: [
								{
									itemId: "item:key",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					radius: 1,
					scope: "local",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:older-replace",
					],
				},
				"item:rock": {
					...baseConfig.items["item:rock"],
					passiveEffectIds: [
						"effect:younger-replace",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 2,
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
		save.board.items["item-instance:2"] = {
			...save.board.items["item-instance:2"],
			createdAtMs: 200,
		};
		save.board.items["item-instance:3"] = {
			...save.board.items["item-instance:3"],
			createdAtMs: 300,
		};
		const product = config.products["product:test"];

		const effective = readEffectiveProducerProductLine({
			baseDurationMs: product.durationMs,
			config,
			nowMs: 1000,
			producerId: "item:producer",
			producerItemId: "item:producer",
			producerItemInstanceId: "item-instance:1",
			product,
			productId: "product:test",
			save,
		});

		expect(effective.lootPlan.baseOutput).toMatchObject([
			{
				itemId: "item:key",
			},
		]);
		expect(effective.appliedEffects.map((effect) => effect.effectId)).toEqual([
			"effect:older-replace",
			"effect:younger-replace",
		]);
	});
	it("adds loot quantity to matching product-line outputs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:bounty": {
					name: "Bounty",
					operations: [
						{
							kind: "loot.quantity.add",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
							value: 1,
						},
					],
					scope: "global",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:bounty",
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
				nowMs: 0,
				producerId: "item:producer",
				producerItemId: "item:producer",
				producerItemInstanceId: "item-instance:1",
				product,
				productId: "product:test",
				save,
			}).lootPlan.baseOutput,
		).toEqual([
			{
				itemId: "item:twig",
				quantity: 3,
				type: "guaranteed",
			},
		]);
	});

	it("adds chance-based extra output only for matching output item tags", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:bounty": {
					name: "Bounty",
					operations: [
						{
							chance: 0.35,
							kind: "loot.extraOutputChance.add",
							outputItems: {
								items: {
									anyOf: [
										{
											ids: [
												"item:twig",
											],
										},
									],
								},
							},
							quantity: 1,
							target: {
								productLines: {
									mode: "all",
								},
							},
						},
					],
					scope: "global",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:bounty",
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

		const effective = readEffectiveProducerProductLine({
			baseDurationMs: product.durationMs,
			config,
			nowMs: 0,
			producerId: "item:producer",
			producerItemId: "item:producer",
			producerItemInstanceId: "item-instance:1",
			product,
			productId: "product:test",
			save,
		});

		expect(effective.lootPlan.baseOutput).toEqual([
			{
				itemId: "item:twig",
				quantity: 2,
				type: "guaranteed",
			},
		]);
		expect(effective.lootPlan.chanceItems).toEqual([
			{
				chance: 0.35,
				effectId: "effect:bounty",
				effectName: "Bounty",
				itemId: "item:twig",
				quantity: 1,
			},
		]);
		expect(effective.appliedEffects.map((effect) => effect.kind)).toEqual([
			"loot.extraOutputChance.add",
		]);
	});
});
