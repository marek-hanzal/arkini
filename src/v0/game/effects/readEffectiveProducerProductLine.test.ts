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
							productIds: [
								"product:shred",
							],
						},
					},
					{
						kind: "line.hide",
						target: {
							productIds: [
								"product:shred",
							],
						},
					},
					{
						kind: "line.blockStart",
						reason: "test block",
						target: {
							productIds: [
								"product:shred",
							],
						},
					},
					{
						kind: "duration.addMs",
						target: {
							productIds: [
								"product:shred",
							],
						},
						valueMs: 500,
					},
					{
						kind: "duration.multiply",
						multiplier: 2,
						target: {
							productIds: [
								"product:shred",
							],
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
							productIds: [
								"product:shred",
							],
						},
					},
					{
						kind: "loot.addChanceItem",
						chance: 0.5,
						itemId: "item:key",
						quantity: 2,
						target: {
							productIds: [
								"product:shred",
							],
						},
					},
					{
						delta: -0.4,
						kind: "loot.dropChance.add",
						target: {
							productIds: [
								"product:shred",
							],
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
			producerId: "producer:test",
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
								all: true,
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
				producerId: "producer:test",
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
								productIds: [
									"product:shred",
								],
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
				producerId: "producer:test",
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
								productIds: [
									"product:shred",
								],
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
				producerId: "producer:test",
				producerItemId: "item:producer",
				producerItemInstanceId: "item-instance:1",
				product,
				productId: "product:shred",
				save,
			}).visible,
		).toBe(true);
	});
});
