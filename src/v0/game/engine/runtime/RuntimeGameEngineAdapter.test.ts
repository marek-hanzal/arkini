import { describe, expect, it } from "vitest";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";

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
		adapter.subscribe((result) => {
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
			completesAtMs: 1200,
			productId: "product:test",
		});
		expect(adapter.readSnapshot().nextWakeAtMs).toBe(1200);
		expect(emitted).toEqual([
			"product.started",
		]);
	});

	it("runs ticks against the stored save and publishes completion events", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});
		const emitted: string[] = [];
		adapter.subscribe((result) => {
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
		});

		expect(readiness).toMatchObject({
			reason: "producer_queue_full",
			type: "rejected",
		});
	});
});
