import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

describe("runGameTickFx", () => {
	it("ignores unfinished jobs", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 999,
			save,
		});

		expect(result.events).toEqual([]);
		expect(result.save.producerJobs).toHaveProperty("job:1");
	});

	it("completes product jobs and places output board first, then inventory", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const result = runTick({
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
				lineId: "line:test",
				type: "line.completed",
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

	it("places producer output around the producer before falling back to distant cells", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 3,
					width: 3,
				},
				title: "Test",
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 1,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(
			result.events
				.filter((event) => event.type === "item.created" && event.to.kind === "board")
				.map((event) => {
					if (event.type !== "item.created" || event.to.kind !== "board") {
						return null;
					}

					return {
						x: event.to.x,
						y: event.to.y,
					};
				}),
		).toEqual([
			{
				x: 1,
				y: 0,
			},
			{
				x: 0,
				y: 1,
			},
		]);
	});

	it("completes already running producer jobs while line state exists", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};
		save.lines["item-instance:1"] = {
			defaultLineId: "line:test",
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId: "job:1",
					lineId: "line:test",
					type: "line.completed",
				}),
			]),
		);
	});

	it("keeps a completed product job pending when output cannot be placed", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs["job:1"]).toMatchObject({
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
		});
		expect(result.nextWakeAtMs).toBe(2000);
		expect(result.events).toEqual([
			{
				atMs: 1000,
				jobId: "job:1",
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				reason: "board:full",
				type: "line.blocked",
			},
		]);
	});

	it("keeps board-only product delivery atomic when only part of the output fits", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					storage: "board",
				},
			},
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.events).toEqual([
			{
				atMs: 1000,
				jobId: "job:1",
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				reason: "board:full",
				type: "line.blocked",
			},
		]);
		expect(result.save.producerJobs["job:1"]).toMatchObject({
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
		});
		expect(Object.values(result.save.board.items)).toEqual([
			expect.objectContaining({
				itemId: "item:producer",
			}),
		]);
		expect(result.save.inventory.slots).toEqual([
			null,
			null,
		]);
	});

	it("retries blocked product delivery by rerolling live output", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:plank",
			quantity: 3,
		};
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const blocked = runTick({
			config,
			nowMs: 1000,
			save,
		});
		const changedConfig = createEngineTestConfig({
			...config,
			lineOverrides: {
				...config.lineCatalog,
				"line:test": {
					...config.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
		});
		blocked.save.inventory.slots[0] = null;

		const delivered = runTick({
			config: changedConfig,
			nowMs: 2000,
			save: blocked.save,
		});

		expect(delivered.save.producerJobs).toEqual({});
		expect(delivered.events).toEqual([
			expect.objectContaining({
				jobId: "job:1",
				type: "line.completed",
			}),
			expect.objectContaining({
				itemId: "item:plank",
				type: "item.created",
			}),
		]);
	});

	it("keeps blocked product delivery quiet until retry wake", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};

		const blocked = runTick({
			config,
			nowMs: 1000,
			save,
		});
		const beforeRetry = runTick({
			config,
			nowMs: 1500,
			save: blocked.save,
		});
		const secondBlocked = runTick({
			config,
			nowMs: 2000,
			save: beforeRetry.save,
		});

		expect(beforeRetry.events).toEqual([]);
		expect(beforeRetry.nextWakeAtMs).toBe(2000);
		expect(secondBlocked.events).toEqual([]);
		expect(secondBlocked.save.producerJobs["job:1"]?.delivery).toMatchObject({
			lastBlockedAtMs: 2000,
			nextAttemptAtMs: 3000,
		});
	});

	it("reschedules queued producer work from a late blocked-delivery release", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
			producerOverrides: {
				"item:producer": {
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.producerJobs["job:blocked"] = {
			readyAtMs: 1000,
			id: "job:blocked",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};
		save.producerJobs["job:queued"] = {
			readyAtMs: 2000,
			id: "job:queued",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 1000,
		};

		const blocked = runTick({
			config,
			nowMs: 1000,
			save,
		});
		expect(blocked.save.producerJobs["job:queued"]).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 2000,
		});

		const retrySave = structuredClone(blocked.save);
		retrySave.inventory.slots[0] = null;
		const retry = runTick({
			config,
			nowMs: 2500,
			save: retrySave,
		});

		expect(retry.save.producerJobs).not.toHaveProperty("job:blocked");
		expect(retry.save.producerJobs["job:queued"]).toMatchObject({
			readyAtMs: 3500,
			startAtMs: 2500,
		});
	});

	it("reserves placement across multiple producers completing in one tick", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 2,
					width: 2,
				},
				title: "Test",
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
						y: 1,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};
		save.producerJobs["job:2"] = {
			readyAtMs: 1000,
			id: "job:2",
			itemInstanceId: "item-instance:2",
			lineId: "line:test",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(
			Object.values(result.save.board.items)
				.filter((item) => item.itemId === "item:twig")
				.map((item) => `${item.x}:${item.y}`)
				.sort(),
		).toEqual([
			"0:1",
			"1:0",
		]);
	});

	it("completes craft jobs by replacing the target with the result item", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:craft"] = {
			readyAtMs: 1000,
			id: "job:craft",
			recipeId: "item:craft-table",
			targetItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.craftJobs).toEqual({});
		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			id: "item-instance:1",
			itemId: "item:plank",
			x: 0,
			y: 0,
		});
		expect(result.save.inventory.slots).toEqual([
			null,
			null,
		]);
		expect(result.save.itemSpawnJobs).toEqual({});
		expect(result.events).toMatchObject([
			{
				jobId: "job:craft",
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.completed",
			},
			{
				fromItemId: "item:craft-table",
				itemInstanceId: "item-instance:1",
				reason: "craft-result",
				toItemId: "item:plank",
				type: "item.replaced",
			},
		]);
	});

	it("completes delayed sink products without output", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toEqual([
			{
				atMs: 1000,
				jobId: "job:1",
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.completed",
			},
		]);
	});

	it("keeps producer queue FIFO when the first delivery is blocked", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			...baseConfig,
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
			producerOverrides: {
				"item:producer": {
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 0,
		};
		save.producerJobs["job:2"] = {
			readyAtMs: 2000,
			id: "job:2",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 1000,
		};

		const result = runTick({
			config,
			nowMs: 2000,
			save,
		});

		expect(result.events).toEqual([
			{
				atMs: 2000,
				jobId: "job:1",
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				reason: "board:full",
				type: "line.blocked",
			},
		]);
		expect(result.nextWakeAtMs).toBe(3000);
		expect(result.save.producerJobs).toHaveProperty("job:1");
		expect(result.save.producerJobs).toHaveProperty("job:2");
		expect(result.save.producerJobs["job:2"]?.delivery).toBeUndefined();
	});
});
