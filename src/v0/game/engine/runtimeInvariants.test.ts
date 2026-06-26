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
	it("requires producer jobs to snapshot output items in the save", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save) as unknown as {
			producerJobs: Record<string, unknown>;
		};
		invalidSave.producerJobs["job:missing-output"] = {
			id: "job:missing-output",
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
			"job:missing-output",
			"outputItems",
		]);
	});

	it("keeps blocked delivery metadata separate from output item snapshots", () => {
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
			"job:duplicated-output",
			"delivery",
		]);
	});

	it("uses empty producer output snapshots as an intentional sink, not a config fallback", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:empty-output"] = {
			id: "job:empty-output",
			outputItems: [],
			placement: "board_then_inventory",
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

		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toEqual([
			{
				atMs: 1000,
				jobId: "job:empty-output",
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "product.completed",
			},
		]);
	});

	it("uses producer output snapshots even when product config changes before completion", () => {
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
		save.producerJobs["job:snapshot"] = {
			id: "job:snapshot",
			outputItems: createOutputItems(),
			placement: "board_then_inventory",
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
					itemId: "item:twig",
					type: "item.created",
				}),
			]),
		);
		expect(result.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:plank",
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
			outputItems: createOutputItems(),
			placement: "board_then_inventory",
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
			outputItems: createOutputItems(),
			placement: "board_then_inventory",
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
			outputItems: [],
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
					placement: "board_then_inventory",
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
			outputItems: [
				{
					itemId: "item:twig",
					quantity: 1,
				},
			],
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.producerJobs["job:queued"] = {
			id: "job:queued",
			outputItems: [
				{
					itemId: "item:plank",
					quantity: 1,
				},
			],
			placement: "board_then_inventory",
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
			outputItems: [
				{
					itemId: "item:twig",
					quantity: 1,
				},
			],
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
					name: "Timed",
					tags: [],
					visibility: "visible",
					placement: "board_then_inventory",
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
			outputItems: [
				{
					itemId: "item:twig",
					quantity: 1,
				},
			],
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.producerJobs["job:timed"] = {
			id: "job:timed",
			outputItems: [],
			placement: "board_then_inventory",
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
});
