import { describe, expect, it } from "vitest";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";

const createConcurrencyTestConfig = () => {
	const base = createEngineTestConfig();
	return createEngineTestConfig({
		game: {
			...base.game,
			board: {
				height: 1,
				width: 4,
			},
		},
		startingState: {
			board: [
				{
					itemId: "item:twig",
					x: 0,
					y: 0,
				},
				{
					itemId: "item:rock",
					x: 1,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

describe("RuntimeGameEngineAdapter", () => {
	it("bootstraps a save from the config starting state", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 100,
			random: TestRandomService,
		});

		expect(adapter.readSnapshot().save).toMatchObject({
			createdAtMs: 100,
			updatedAtMs: 100,
			board: {
				items: {
					"item-instance:1": {
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
				},
			},
		});
	});

	it("dispatches actions, stores the next save and emits domain results", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});
		const emitted: string[] = [];
		const emittedAtMs: number[] = [];
		adapter.subscribe(({ nowMs, result }) => {
			emittedAtMs.push(nowMs);
			emitted.push(...result.events.map((event) => event.type));
		});

		const result = await adapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 200,
		});

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
		expect(Object.values(adapter.readSnapshot().save.producerJobs)[0]).toMatchObject({
			readyAtMs: 1200,
			productId: "product:test",
		});
		expect(adapter.readSnapshot().nextWakeAtMs).toBe(1200);
		expect(emitted).toEqual([
			"product.started",
		]);
		expect(emittedAtMs).toEqual([
			200,
		]);
	});

	it("runs ticks against the stored save and publishes completion events", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});
		const emitted: string[] = [];
		adapter.subscribe(({ result }) => {
			emitted.push(...result.events.map((event) => event.type));
		});

		await adapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 0,
		});
		const result = await adapter.tick({
			nowMs: 1000,
		});

		expect(result.events.map((event) => event.type)).toEqual([
			"product.completed",
			"item.created",
			"item.created",
		]);
		expect(adapter.readSnapshot().save.producerJobs).toEqual({});
		expect(emitted).toEqual([
			"product.started",
			"product.completed",
			"item.created",
			"item.created",
		]);
	});

	it("publishes due tick catch-up and a dispatched action as one runtime update", async () => {
		const base = createEngineTestConfig();
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig({
				game: {
					...base.game,
					board: {
						height: 1,
						width: 4,
					},
				},
				products: {
					...base.products,
					"product:test": {
						...base.products["product:test"],
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
					board: [
						{
							itemId: "item:producer",
							x: 0,
							y: 0,
						},
						{
							itemId: "item:rock",
							x: 1,
							y: 0,
						},
					],
					inventory: [],
				},
			}),
			nowMs: 0,
			random: TestRandomService,
		});
		const updates: string[][] = [];
		adapter.subscribe(({ result }) => {
			updates.push(result.events.map((event) => event.type));
		});

		await adapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 0,
		});
		updates.length = 0;

		const result = await adapter.dispatch({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
			nowMs: 1200,
		});

		expect(result.events.map((event) => event.type)).toEqual([
			"product.completed",
			"item.created",
		]);
		expect(updates).toEqual([
			[
				"product.completed",
				"item.created",
			],
		]);
		expect(adapter.readSnapshot().save.board.items["item-instance:2"]).toMatchObject({
			x: 3,
			y: 0,
		});
	});

	it("keeps and publishes due catch-up when the following dispatched action is rejected", async () => {
		const base = createEngineTestConfig();
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig({
				game: {
					...base.game,
					board: {
						height: 1,
						width: 3,
					},
				},
				products: {
					...base.products,
					"product:test": {
						...base.products["product:test"],
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
					board: [
						{
							itemId: "item:producer",
							x: 0,
							y: 0,
						},
						{
							itemId: "item:rock",
							x: 1,
							y: 0,
						},
					],
					inventory: [],
				},
			}),
			nowMs: 0,
			random: TestRandomService,
		});
		const updates: string[][] = [];
		adapter.subscribe(({ result }) => {
			updates.push(result.events.map((event) => event.type));
		});

		await adapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 0,
		});
		updates.length = 0;

		await expect(
			adapter.dispatch({
				action: {
					boardItemId: "item-instance:2",
					type: "board.item.move",
					x: 2,
					y: 0,
				},
				nowMs: 1200,
			}),
		).rejects.toThrow();

		expect(updates).toEqual([
			[
				"product.completed",
				"item.created",
			],
		]);
		expect(adapter.readSnapshot().save.producerJobs).toEqual({});
		expect(adapter.readSnapshot().save.board.items["item-instance:2"]).toMatchObject({
			x: 1,
			y: 0,
		});
		expect(Object.values(adapter.readSnapshot().save.board.items)).toContainEqual(
			expect.objectContaining({
				itemId: "item:twig",
				x: 2,
				y: 0,
			}),
		);
	});

	it("reads readiness from the current stored save", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});

		await adapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 100,
		});
		const readiness = await adapter.readiness({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 200,
		});

		expect(readiness).toMatchObject({
			reason: "producer_queue_full",
			type: "rejected",
		});
	});

	it("catches up ready ticks before reading readiness", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});

		await adapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 100,
		});

		const readiness = await adapter.readiness({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 1200,
		});

		expect(readiness).toMatchObject({
			type: "ready",
		});
		expect(adapter.readSnapshot().save.producerJobs).toEqual({});
	});

	it("catches up a stale loaded save before same-instant readiness checks", async () => {
		const config = createEngineTestConfig();
		const sourceAdapter = await RuntimeGameEngineAdapter.create({
			config,
			nowMs: 0,
			random: TestRandomService,
		});
		await sourceAdapter.dispatch({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 0,
		});

		const adapter = await RuntimeGameEngineAdapter.create({
			config,
			initialSave: sourceAdapter.readSave(),
			nowMs: 1500,
			random: TestRandomService,
		});

		const readiness = await adapter.readiness({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			nowMs: 1500,
		});

		expect(readiness).toMatchObject({
			type: "ready",
		});
		expect(adapter.readSnapshot().save.producerJobs).toEqual({});
	});

	it("waits for queued mutations before reading readiness", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createConcurrencyTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});
		let releaseMutation: (() => void) | undefined;
		(
			adapter as unknown as {
				mutationQueue: Promise<void>;
			}
		).mutationQueue = new Promise((resolve) => {
			releaseMutation = resolve;
		});
		let resolved = false;
		const readinessPromise = adapter
			.readiness({
				action: {
					boardItemId: "item-instance:1",
					type: "board.item.move",
					x: 2,
					y: 0,
				},
			})
			.then((readiness) => {
				resolved = true;
				return readiness;
			});

		await Promise.resolve();
		expect(resolved).toBe(false);

		releaseMutation?.();
		await expect(readinessPromise).resolves.toMatchObject({
			type: "ready",
		});
	});

	it("serializes concurrent dispatches so independent board updates are not lost", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createConcurrencyTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});

		await Promise.all([
			adapter.dispatch({
				action: {
					boardItemId: "item-instance:1",
					type: "board.item.move",
					x: 2,
					y: 0,
				},
				nowMs: 10,
			}),
			adapter.dispatch({
				action: {
					boardItemId: "item-instance:2",
					type: "board.item.move",
					x: 3,
					y: 0,
				},
				nowMs: 20,
			}),
		]);

		expect(adapter.readSnapshot().save.board.items).toMatchObject({
			"item-instance:1": {
				x: 2,
				y: 0,
			},
			"item-instance:2": {
				x: 3,
				y: 0,
			},
		});
	});

	it("serializes replaceSave after an in-flight dispatch", async () => {
		const config = createConcurrencyTestConfig();
		const adapter = await RuntimeGameEngineAdapter.create({
			config,
			nowMs: 0,
			random: TestRandomService,
		});
		const replacement = {
			...adapter.readSave(),
			board: {
				items: {
					"item-instance:reset": {
						id: "item-instance:reset",
						itemId: "item:plank",
						x: 0,
						y: 0,
					},
				},
			},
		};

		await Promise.all([
			adapter.dispatch({
				action: {
					boardItemId: "item-instance:1",
					type: "board.item.move",
					x: 2,
					y: 0,
				},
				nowMs: 10,
			}),
			adapter.replaceSave({
				nowMs: 20,
				save: replacement,
			}),
		]);

		expect(adapter.readSnapshot().save.board.items).toEqual({
			"item-instance:reset": {
				id: "item-instance:reset",
				itemId: "item:plank",
				x: 0,
				y: 0,
			},
		});
		expect(adapter.readSnapshot().save.updatedAtMs).toBe(20);
	});
});
