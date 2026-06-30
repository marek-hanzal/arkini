import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { GameSaveConfigSchema, type GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { pastDueGameJobWakeDelayMs, readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { withRandomService } from "~/v0/random/logic/withRandomService";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

const runNextWakeAtMs = (props: readNextWakeAtMsFx.Props) =>
	Effect.runSync(readNextWakeAtMsFx(props));

const cloneSave = (save: GameSave): GameSave => structuredClone(save);

const createOutputItems = () => [
	{
		itemId: "item:twig",
		quantity: 2,
	},
];

describe("runtime invariants", () => {
	it("rejects stale producer output or placement fields in the save", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save) as unknown as {
			producerJobs: Record<string, unknown>;
		};
		invalidSave.producerJobs["job:stale-derived"] = {
			id: "job:stale-derived",
			outputItems: createOutputItems(),
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([
			"save",
			"producerJobs",
			"job:stale-derived",
		]);
	});

	it("keeps blocked delivery metadata separate from derived output items", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save) as unknown as {
			producerJobs: Record<string, unknown>;
		};
		invalidSave.producerJobs["job:duplicated-output"] = {
			delivery: {
				items: createOutputItems(),
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
			id: "job:duplicated-output",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([
			"save",
			"producerJobs",
			"job:duplicated-output",
			"delivery",
		]);
	});

	it("completes live sink products without generated output", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:empty-output"] = {
			id: "job:empty-output",
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
			readyAtMs: 1000,
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
				jobId: "job:empty-output",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "product.completed",
			},
		]);
	});

	it("rolls producer output from live config at completion", () => {
		const baseConfig = createEngineTestConfig();
		const changedConfig = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
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
		const save = runInitialSave({
			config: baseConfig,
			nowMs: 0,
		});
		save.producerJobs["job:live-output"] = {
			id: "job:live-output",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const result = runTick({
			config: changedConfig,
			nowMs: 1000,
			save,
		});

		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:plank",
					type: "item.created",
				}),
			]),
		);
		expect(result.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
			]),
		);
	});

	it("schedules a past-due blocked producer delivery retry after loading stale save data", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:blocked"] = {
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
			id: "job:blocked",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		expect(
			runNextWakeAtMs({
				config,
				nowMs: 3000,
				save,
			}),
		).toBe(3000 + pastDueGameJobWakeDelayMs);
	});

	it("allows already queued producer jobs behind a paused previous job", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:paused"] = {
			id: "job:paused",
			pausedAtMs: 250,
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			remainingMs: 750,
			startAtMs: 0,
		};
		save.producerJobs["job:queued-behind-pause"] = {
			id: "job:queued-behind-pause",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 2500,
			startAtMs: 1500,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save,
		});

		expect(result.success).toBe(true);
	});

	it("rejects stale queued producer timing behind blocked delivery", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const invalidSave = runInitialSave({
			config,
			nowMs: 0,
		});
		invalidSave.producerJobs["job:blocked"] = {
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 3000,
			},
			id: "job:blocked",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		invalidSave.producerJobs["job:stale"] = {
			id: "job:stale",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 2000,
			startAtMs: 1000,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: [
						"save",
						"producerJobs",
						"job:stale",
						"startAtMs",
					],
				}),
			]),
		);
	});
	it("rejects blocked delivery on a non-head producer queue job", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const invalidSave = runInitialSave({
			config,
			nowMs: 0,
		});
		invalidSave.producerJobs["job:first"] = {
			id: "job:first",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		invalidSave.producerJobs["job:blocked-second"] = {
			delivery: {
				lastBlockedAtMs: 2000,
				nextAttemptAtMs: 3000,
			},
			id: "job:blocked-second",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 2000,
			startAtMs: 1000,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: [
						"save",
						"producerJobs",
						"job:blocked-second",
						"delivery",
					],
				}),
			]),
		);
	});
});
