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

	it("does not let an active effect block product output at its exact end time", () => {
		const config = createEngineTestConfig({
			effects: {
				"effect:block-twig": {
					name: "Block twig",
					operations: [
						{
							kind: "item.blockCreate",
							target: {
								itemIds: [
									"item:twig",
								],
							},
						},
					],
					scope: "global",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:block-twig"] = {
			effectId: "effect:block-twig",
			endAtMs: 1000,
			id: "effect-instance:block-twig",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};
		save.producerJobs["job:boundary"] = {
			id: "job:boundary",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.events).toMatchObject([
			{
				jobId: "job:boundary",
				type: "product.completed",
			},
			{
				itemId: "item:twig",
				type: "item.created",
			},
			{
				itemId: "item:twig",
				type: "item.created",
			},
			{
				id: "effect-instance:block-twig",
				type: "effect.expired",
			},
		]);
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
				nowMs: 3000,
				save,
			}),
		).toBe(3000 + pastDueGameJobWakeDelayMs);
	});
	it("requires active-effect producer jobs to keep a linked active effect instance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:timed": {
					name: "Timed effect",
					operations: [
						{
							kind: "duration.addMs",
							target: {
								all: true,
							},
							valueMs: 0,
						},
					],
					scope: "global",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					activatesEffectId: "effect:timed",
					output: undefined,
				},
			},
		});
		const invalidSave = runInitialSave({
			config,
			nowMs: 0,
		});
		invalidSave.producerJobs["job:timed"] = {
			id: "job:timed",
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
		expect(result.error?.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: [
						"save",
						"producerJobs",
						"job:timed",
					],
				}),
			]),
		);
	});

	it("rejects producer queue jobs behind a paused previous job", () => {
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
		save.producerJobs["job:illegal-behind-pause"] = {
			id: "job:illegal-behind-pause",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 2500,
			startAtMs: 1500,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: [
						"save",
						"producerJobs",
						"job:illegal-behind-pause",
						"startAtMs",
					],
				}),
			]),
		);
	});

	it("reschedules queued producer jobs when a previous delivery blocks", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:replace-output": {
					name: "Replace output",
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
									"product:effect-output",
								],
							},
						},
					],
					scope: "global",
				},
			},
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
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:effect-output",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:effect-output": {
					durationMs: 1000,
					placement: "board_then_inventory",
					name: "Effect output",
					tags: [],
					visibility: "visible",
					output: [
						{
							itemId: "item:twig",
							quantity: 1,
							type: "guaranteed",
						},
					],
					requirementIds: [],
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
		save.activeEffects["effect-instance:replace-output"] = {
			effectId: "effect:replace-output",
			endAtMs: 1500,
			id: "effect-instance:replace-output",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};
		save.producerJobs["job:blocking"] = {
			id: "job:blocking",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.producerJobs["job:queued"] = {
			id: "job:queued",
			producerItemInstanceId: "item-instance:1",
			productId: "product:effect-output",
			readyAtMs: 2000,
			startAtMs: 1000,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs["job:blocking"]?.delivery).toEqual({
			lastBlockedAtMs: 1000,
			nextAttemptAtMs: 2000,
		});
		expect(result.save.producerJobs["job:queued"]).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 2000,
		});
	});

	it("keeps queued producer active effects aligned with blocked delivery delays", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:timed": {
					name: "Timed effect",
					operations: [
						{
							kind: "duration.addMs",
							target: {
								all: true,
							},
							valueMs: 0,
						},
					],
					scope: "global",
				},
			},
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
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:timed",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:timed": {
					activatesEffectId: "effect:timed",
					durationMs: 1000,
					placement: "board_then_inventory",
					name: "Timed",
					tags: [],
					visibility: "visible",
					requirementIds: [],
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
		save.producerJobs["job:blocking"] = {
			id: "job:blocking",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.producerJobs["job:timed"] = {
			id: "job:timed",
			producerItemInstanceId: "item-instance:1",
			productId: "product:timed",
			readyAtMs: 2000,
			startAtMs: 1000,
		};
		save.activeEffects["effect-instance:timed"] = {
			effectId: "effect:timed",
			endAtMs: 2000,
			id: "effect-instance:timed",
			producerJobId: "job:timed",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 1000,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs["job:timed"]).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 2000,
		});
		expect(result.save.activeEffects["effect-instance:timed"]).toMatchObject({
			endAtMs: 3000,
			producerJobId: "job:timed",
			startAtMs: 2000,
		});
	});
	it("ignores stale queued active effects while rescheduling producer timing", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:self-slow": {
					name: "Self slow",
					operations: [
						{
							kind: "duration.addMs",
							target: {
								productIds: [
									"product:self-timed",
								],
							},
							valueMs: 1000,
						},
					],
					scope: "global",
				},
			},
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
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:self-timed",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:self-timed": {
					activatesEffectId: "effect:self-slow",
					durationMs: 4000,
					placement: "board_then_inventory",
					name: "Self timed",
					tags: [],
					visibility: "visible",
					requirementIds: [],
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
		save.producerJobs["job:blocking"] = {
			id: "job:blocking",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.producerJobs["job:self-timed"] = {
			id: "job:self-timed",
			producerItemInstanceId: "item-instance:1",
			productId: "product:self-timed",
			readyAtMs: 5000,
			startAtMs: 1000,
		};
		save.activeEffects["effect-instance:self-timed"] = {
			effectId: "effect:self-slow",
			endAtMs: 5000,
			id: "effect-instance:self-timed",
			producerJobId: "job:self-timed",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 1000,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs["job:self-timed"]).toMatchObject({
			readyAtMs: 6000,
			startAtMs: 2000,
		});
		expect(result.save.activeEffects["effect-instance:self-timed"]).toMatchObject({
			endAtMs: 6000,
			producerJobId: "job:self-timed",
			startAtMs: 2000,
		});
	});

	it("allows completed active-effect sink products after the linked effect expires", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:timed": {
					name: "Timed",
					operations: [
						{
							kind: "duration.addMs",
							target: {
								all: true,
							},
							valueMs: 0,
						},
					],
					scope: "global",
				},
			},
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
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					activatesEffectId: "effect:timed",
					output: undefined,
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
		save.producerJobs["job:timed-blocked"] = {
			id: "job:timed-blocked",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.activeEffects["effect-instance:timed-blocked"] = {
			effectId: "effect:timed",
			endAtMs: 1000,
			id: "effect-instance:timed-blocked",
			producerJobId: "job:timed-blocked",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const result = runTick({
			config,
			nowMs: 1000,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(result.save.activeEffects).toEqual({});
		expect(
			GameSaveConfigSchema.safeParse({
				config,
				save: result.save,
			}).success,
		).toBe(true);
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
