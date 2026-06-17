import { describe, expect, it } from "vitest";
import { createInitialGameSave } from "~/v0/game/engine/logic/createInitialGameSave";
import { runGameTick } from "~/v0/game/engine/logic/runGameTick";
import { createEngineTestConfig } from "~/v0/game/engine/logic/testGameConfig";

describe("runGameTick", () => {
	it("ignores unfinished jobs", () => {
		const config = createEngineTestConfig();
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			completesAtMs: 1000,
			id: "job:1",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startedAtMs: 0,
		};

		const result = runGameTick({
			config,
			nowMs: 999,
			save,
		});

		expect(result.events).toEqual([]);
		expect(result.save.producerJobs).toHaveProperty("job:1");
	});

	it("completes product jobs and places output board first, then inventory", () => {
		const config = createEngineTestConfig();
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			completesAtMs: 1000,
			id: "job:1",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startedAtMs: 0,
		};

		const result = runGameTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs).not.toHaveProperty("job:1");
		expect(result.save.inventory.slots).toEqual([
			{
				itemId: "item:twig",
				quantity: 1,
			},
			null,
		]);
		expect(result.events).toMatchObject([
			{
				jobId: "job:1",
				productId: "product:test",
				type: "product.completed",
			},
			{
				itemId: "item:twig",
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				itemId: "item:twig",
				to: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("keeps a completed product job pending when output cannot be placed", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 0,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
		});
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			completesAtMs: 1000,
			id: "job:1",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startedAtMs: 0,
		};

		const result = runGameTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs).toHaveProperty("job:1");
		expect(result.events).toEqual([
			{
				blockedAtMs: 1000,
				jobId: "job:1",
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				reason: "placement_unavailable",
				type: "product.blocked",
			},
		]);
	});

	it("completes craft jobs only when requirement returns and result can be placed", () => {
		const config = createEngineTestConfig();
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:craft"] = {
			completesAtMs: 1000,
			id: "job:craft",
			recipeId: "craft:plank",
			returnItems: [
				{
					itemId: "item:twig",
					quantity: 1,
				},
			],
			startedAtMs: 0,
		};

		const result = runGameTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.craftJobs).toEqual({});
		expect(result.save.inventory.slots).toEqual([
			{
				itemId: "item:plank",
				quantity: 1,
			},
			null,
		]);
		expect(result.events).toMatchObject([
			{
				jobId: "job:craft",
				recipeId: "craft:plank",
				type: "craft.completed",
			},
			{
				itemId: "item:twig",
				reason: "craft-requirement-return",
				to: {
					kind: "board",
				},
				type: "item.created",
			},
			{
				itemId: "item:plank",
				reason: "craft-output",
				to: {
					kind: "inventory",
				},
				type: "item.created",
			},
		]);
	});

	it("completes delayed sink products without output", () => {
		const config = createEngineTestConfig();
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			completesAtMs: 1000,
			id: "job:1",
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
			startedAtMs: 0,
		};

		const result = runGameTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toEqual([
			{
				completedAtMs: 1000,
				jobId: "job:1",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "product.completed",
			},
		]);
	});
});
