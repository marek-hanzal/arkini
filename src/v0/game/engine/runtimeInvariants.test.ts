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
});
