import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";
import {
	findBoardItem,
	runAction,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

const createRealtimeDurationConfig = ({ sourceX }: { sourceX: number }) => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:nearby-speed": {
				name: "Nearby speed",
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
					"effect:nearby-speed",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 1000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
					},
				],
			},
		},
		startingState: {
			...baseConfig.startingState,
			board: [
				{
					itemId: "item:producer",
					x: 0,
					y: 0,
				},
				{
					itemId: "item:axe",
					x: sourceX,
					y: 0,
				},
			],
		},
	});
};

const createRealtimeOutputConfig = ({ sourceX }: { sourceX: number }) => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:nearby-output": {
				name: "Nearby output",
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
							productIds: [
								"product:test",
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
					"effect:nearby-output",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
					},
				],
			},
		},
		startingState: {
			...baseConfig.startingState,
			board: [
				{
					itemId: "item:producer",
					x: 0,
					y: 0,
				},
				{
					itemId: "item:axe",
					x: sourceX,
					y: 0,
				},
			],
		},
	});
};

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

const startProducer = ({ config, nowMs, save }: Parameters<typeof runAction>[0]) =>
	runAction({
		config,
		nowMs,
		save,
		action: {
			inputRefs: [],
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			type: "producer.product.start",
		},
	});

const createOutputCreatesRealtimeSourceConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:nearby-speed": {
				name: "Nearby speed",
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
			inventory: {
				slots: 3,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:nearby-speed",
				],
			},
		},
		producers: {
			...baseConfig.producers,
			"item:producer": {
				...baseConfig.producers["item:producer"],
				maxQueueSize: 2,
				productIds: [
					"product:test",
					"product:spawn-buff",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 5000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
					},
				],
			},
			"product:spawn-buff": {
				durationMs: 1000,
				name: "Spawn buff",
				output: [
					{
						itemId: "item:axe",
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
			],
			inventory: [],
		},
	});
};

const createCraftCreatesRealtimeSourceConfig = () => {
	const baseConfig = createOutputCreatesRealtimeSourceConfig();
	return createEngineTestConfig({
		...baseConfig,
		craftRecipes: {
			...baseConfig.craftRecipes,
			"item:craft-table": {
				durationMs: 1000,
				inputs: [],
				requirements: [],
				resultItemId: "item:axe",
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
					itemId: "item:craft-table",
					x: 2,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

describe("realtime producer effects", () => {
	it("extends a running producer job when a local duration source leaves proximity", () => {
		const config = createRealtimeDurationConfig({
			sourceX: 1,
		});
		const initialSave = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			save: initialSave,
			action: null,
		});
		const jobId = Object.keys(started.save.producerJobs)[0] as string;
		expect(started.save.producerJobs[jobId]).toMatchObject({
			readyAtMs: 100,
			startAtMs: 0,
		});

		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 1,
			y: 0,
		});
		expect(source).toBeDefined();

		const moved = runAction({
			config,
			nowMs: 50,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
		});

		expect(moved.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "product.completed",
				}),
			]),
		);
		expect(moved.save.producerJobs[jobId]).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});
		expect(moved.nextWakeAtMs).toBe(1000);
	});

	it("rerolls producer output when a local loot source leaves proximity before completion", () => {
		const config = createRealtimeOutputConfig({
			sourceX: 1,
		});
		const initialSave = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			save: initialSave,
			action: null,
		});

		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 1,
			y: 0,
		});
		expect(source).toBeDefined();

		const moved = runAction({
			config,
			nowMs: 500,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
		});
		const completed = runTick({
			config,
			nowMs: 1000,
			save: moved.save,
		});

		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "product.completed",
				}),
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
			]),
		);
		expect(completed.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:plank",
					type: "item.created",
				}),
			]),
		);
	});

	it("completes a running producer job immediately when a local duration source enters proximity", () => {
		const config = createRealtimeDurationConfig({
			sourceX: 2,
		});
		const initialSave = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			save: initialSave,
			action: null,
		});
		const jobId = Object.keys(started.save.producerJobs)[0] as string;
		expect(started.save.producerJobs[jobId]).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 2,
			y: 0,
		});
		expect(source).toBeDefined();

		const moved = runAction({
			config,
			nowMs: 500,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
		});

		expect(moved.save.producerJobs[jobId]).toBeUndefined();
		expect(moved.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId,
					type: "product.completed",
				}),
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
			]),
		);
	});

	it("resyncs and completes producer jobs after another producer creates an effect source", () => {
		const config = createOutputCreatesRealtimeSourceConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:creates-buff"] = {
			id: "job:creates-buff",
			producerItemInstanceId: "item-instance:1",
			productId: "product:spawn-buff",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.producerJobs["job:uses-buff"] = {
			id: "job:uses-buff",
			producerItemInstanceId: "item-instance:2",
			productId: "product:test",
			readyAtMs: 5000,
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId: "job:creates-buff",
					type: "product.completed",
				}),
				expect.objectContaining({
					itemId: "item:axe",
					type: "item.created",
				}),
				expect.objectContaining({
					jobId: "job:uses-buff",
					type: "product.completed",
				}),
			]),
		);
		expect(result.save.producerJobs).toEqual({});
	});

	it("resyncs and completes producer jobs after craft creates an effect source", () => {
		const config = createCraftCreatesRealtimeSourceConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:uses-crafted-buff"] = {
			id: "job:uses-crafted-buff",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 5000,
			startAtMs: 0,
		};
		save.craftJobs["job:crafts-buff"] = {
			id: "job:crafts-buff",
			recipeId: "item:craft-table",
			readyAtMs: 1000,
			startAtMs: 0,
			targetItemInstanceId: "item-instance:2",
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId: "job:crafts-buff",
					type: "craft.completed",
				}),
				expect.objectContaining({
					fromItemId: "item:craft-table",
					toItemId: "item:axe",
					type: "item.replaced",
				}),
				expect.objectContaining({
					jobId: "job:uses-crafted-buff",
					type: "product.completed",
				}),
			]),
		);
		expect(result.save.producerJobs).toEqual({});
		expect(result.save.craftJobs).toEqual({});
	});
});
