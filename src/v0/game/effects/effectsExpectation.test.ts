import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import {
	findBoardItem,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

const createLocalCraftBlockConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		craftRecipes: {
			...baseConfig.craftRecipes,
			"item:craft-table": {
				...baseConfig.craftRecipes["item:craft-table"],
				inputs: [],
				requirements: [],
			},
		},
		effects: {
			"effect:nearby-no-planks": {
				name: "Nearby no planks",
				operations: [
					{
						kind: "item.blockCreate",
						reason: "plank blocked near axe",
						target: {
							itemIds: [
								"item:plank",
							],
						},
					},
				],
				radius: 1,
				scope: "local",
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 3,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:nearby-no-planks",
				],
			},
			"item:craft-table": {
				...baseConfig.items["item:craft-table"],
				storage: "both",
			},
		},
		startingState: {
			board: [
				{
					itemId: "item:craft-table",
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
};

const createLineVisibilityConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:hide-test-product": {
				name: "Hide test product",
				operations: [
					{
						kind: "line.hide",
						target: {
							productIds: [
								"product:test",
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
					"effect:hide-test-product",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:other": {
				chargeCost: 0,
				durationMs: 1000,
				name: "Other product",
				output: [
					{
						itemId: "item:plank",
						quantity: 1,
						type: "guaranteed",
					},
				],
				placement: "board_then_inventory",
				requirementIds: [],
				tags: [],
				visibility: "visible",
			},
		},
		producers: {
			...baseConfig.producers,
			"item:producer": {
				...baseConfig.producers["item:producer"],
				maxQueueSize: 2,
				productIds: [
					"product:test",
					"product:other",
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
					itemId: "item:axe",
					quantity: 1,
				},
			],
		},
	});
};

const createItemCreateTargetConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:block-planks-only": {
				name: "Block planks only",
				operations: [
					{
						kind: "item.blockCreate",
						target: {
							itemIds: [
								"item:plank",
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
					"effect:block-planks-only",
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
					itemId: "item:axe",
					quantity: 1,
				},
			],
		},
	});
};

const createFutureActiveEffectConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:future-speed": {
				name: "Future speed",
				operations: [
					{
						kind: "duration.multiply",
						multiplier: 0.1,
						target: {
							productIds: [
								"product:test",
							],
						},
					},
				],
				scope: "global",
			},
		},
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
				durationMs: 1000,
			},
		},
		producers: {
			...baseConfig.producers,
			"item:producer": {
				...baseConfig.producers["item:producer"],
				maxQueueSize: 1,
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
					itemId: "item:producer",
					x: 1,
					y: 0,
				},
				{
					itemId: "item:axe",
					x: 2,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

describe("effect expectation integration", () => {
	it("does not permanently fail delayed craft completion when a temporary local create blocker is active", () => {
		const config = createLocalCraftBlockConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:craft"] = {
			id: "job:craft",
			readyAtMs: 1000,
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const blocked = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(blocked.events).toEqual([
			{
				atMs: 1000,
				jobId: "job:craft",
				reason: "effect:block-create",
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.blocked",
			},
		]);
		expect(blocked.save.craftJobs["job:craft"]).toMatchObject({
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
		});
		expect(blocked.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:craft-table",
		});
	});

	it("releases a blocked delayed craft completion when the local create blocker leaves proximity", () => {
		const config = createLocalCraftBlockConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:craft"] = {
			id: "job:craft",
			readyAtMs: 1000,
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};
		const blocked = runTick({
			config,
			nowMs: 1000,
			save,
		});
		const blocker = findBoardItem(blocked.save, {
			itemId: "item:axe",
			x: 1,
			y: 0,
		});
		expect(blocker).toBeDefined();

		const moved = runAction({
			action: {
				boardItemId: blocker?.id ?? "missing",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
			config,
			nowMs: 1999,
			save: blocked.save,
		});
		const released = runTick({
			config,
			nowMs: 2000,
			save: moved.save,
		});

		expect(released.save.craftJobs).toEqual({});
		expect(released.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:plank",
		});
		expect(released.events).toEqual([
			expect.objectContaining({
				jobId: "job:craft",
				type: "craft.completed",
			}),
			expect.objectContaining({
				fromItemId: "item:craft-table",
				toItemId: "item:plank",
				type: "item.replaced",
			}),
		]);
	});

	it("does not let a product-line hide effect leak to unrelated product lines", () => {
		const config = createLineVisibilityConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const hiddenProduct = runActionEither({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		expect(hiddenProduct).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			},
		});

		const unrelatedProduct = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:other",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		expect(Object.values(unrelatedProduct.save.producerJobs)).toEqual([
			expect.objectContaining({
				productId: "product:other",
			}),
		]);
	});

	it("does not let item.create block effects leak to non-target item outputs", () => {
		const config = createItemCreateTargetConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const completed = runTick({
			config,
			nowMs: 1000,
			save: started.save,
		});

		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
			]),
		);
		expect(completed.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					reason: "effect:block-create",
				}),
			]),
		);
	});

	it("does not apply active effects before their start window opens", () => {
		const config = createFutureActiveEffectConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:future-speed"] = {
			effectId: "effect:future-speed",
			endAtMs: 1000,
			id: "effect-instance:future-speed",
			sourceItemInstanceId: "item-instance:3",
			startAtMs: 500,
		};

		const beforeWindow = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const beforeWindowJob = Object.values(beforeWindow.save.producerJobs)[0];
		expect(beforeWindowJob).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const insideWindow = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:2",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save: beforeWindow.save,
		});
		const insideWindowJob = Object.values(insideWindow.save.producerJobs).find(
			(job) => job.producerItemInstanceId === "item-instance:2",
		);
		expect(insideWindowJob).toMatchObject({
			readyAtMs: 600,
			startAtMs: 500,
		});
	});
});
