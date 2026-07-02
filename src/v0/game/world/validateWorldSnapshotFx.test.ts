import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { RuntimeGameEngineAdapter } from "~/v0/game/engine/runtime/RuntimeGameEngineAdapter";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { readWorldSnapshotFactsFx } from "~/v0/game/world/readWorldSnapshotFactsFx";
import { validateWorldSnapshotFx } from "~/v0/game/world/validateWorldSnapshotFx";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

const runWorldFacts = (props: readWorldSnapshotFactsFx.Props) =>
	Effect.runSync(readWorldSnapshotFactsFx(props));

const runWorldValidation = (props: validateWorldSnapshotFx.Props) =>
	Effect.runSync(validateWorldSnapshotFx(props));

const cloneSave = (save: GameSave): GameSave => structuredClone(save);

describe("validateWorldSnapshotFx", () => {
	it("keeps active effect wake reasons focused on future transitions", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:running"] = {
			effectId: "effect:test",
			endAtMs: 1000,
			id: "effect-instance:running",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 100,
		};

		const facts = runWorldFacts({
			config,
			nowMs: 500,
			save,
		});

		expect(facts.wakePlan.wakeReasons).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entity: {
						id: "effect-instance:running",
						kind: "activeEffect",
					},
					reason: "active_effect_start",
				}),
			]),
		);
		expect(facts.wakePlan.wakeReasons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					atMs: 1000,
					entity: {
						id: "effect-instance:running",
						kind: "activeEffect",
					},
					reason: "active_effect_end",
				}),
			]),
		);
	});

	it("normalizes craft job lifecycle and wake reasons in the same snapshot report", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:running"] = {
			id: "job:running",
			readyAtMs: 1000,
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const runningFacts = runWorldFacts({
			config,
			nowMs: 500,
			save,
		});

		expect(runningFacts.craftJobs).toMatchObject([
			{
				job: {
					id: "job:running",
				},
				releaseAtMs: 1000,
				status: "running",
			},
		]);
		expect(runningFacts.wakePlan.wakeReasons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					atMs: 1000,
					entity: {
						id: "job:running",
						kind: "craftJob",
					},
					reason: "craft_ready",
				}),
			]),
		);

		save.craftJobs["job:running"] = {
			...save.craftJobs["job:running"],
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2500,
			},
		};
		const blockedFacts = runWorldFacts({
			config,
			nowMs: 1500,
			save,
		});

		expect(blockedFacts.craftJobs).toMatchObject([
			{
				releaseAtMs: 2500,
				status: "delivery_blocked",
			},
		]);
	});

	it("normalizes replacement safety facts without turning normal runtime state into an issue", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 1,
			},
		};

		const result = runWorldValidation({
			checks: [
				"replacement-safety",
			],
			config,
			nowMs: 0,
			save,
		});

		expect(result.issues).toEqual([]);
		expect(result.facts.replacementSafety).toContainEqual({
			blockReasons: [
				"craft_input_state",
			],
			itemInstanceId: "item-instance:1",
			status: "blocked",
		});
	});

	it("reports live replacement-safety conflicts against a selected check set", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:producer": {
					durationMs: 1000,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:producer"] = {
			id: "job:producer",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.craftJobs["job:craft"] = {
			id: "job:craft",
			recipeId: "item:producer",
			readyAtMs: 1000,
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const result = runWorldValidation({
			checks: [
				"replacement-safety",
			],
			config,
			nowMs: 500,
			save,
		});

		expect(result.issues).toEqual([
			expect.objectContaining({
				code: "craft_and_producer_share_target",
				entity: {
					id: "item-instance:1",
					kind: "boardItem",
				},
			}),
		]);
	});

	it("reports impossible paused delivery jobs from a live snapshot", () => {
		const config = createEngineTestConfig();
		const save = cloneSave(
			runInitialSave({
				config,
				nowMs: 0,
			}),
		);
		save.producerJobs["job:broken"] = {
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
			id: "job:broken",
			pausedAtMs: 1000,
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			readyAtMs: 1000,
			remainingMs: 500,
			startAtMs: 0,
		};

		const result = runWorldValidation({
			checks: [
				"producer-queues",
			],
			config,
			nowMs: 1500,
			save,
		});

		expect(result.issues).toEqual([
			expect.objectContaining({
				code: "delivery_job_paused",
			}),
		]);
	});

	it("reports delivery retry state that predates job readiness", () => {
		const producerConfig = createEngineTestConfig();
		const producerSave = cloneSave(
			runInitialSave({
				config: producerConfig,
				nowMs: 0,
			}),
		);
		producerSave.producerJobs["job:producer"] = {
			delivery: {
				lastBlockedAtMs: 999,
				nextAttemptAtMs: 2000,
			},
			id: "job:producer",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const producerResult = runWorldValidation({
			checks: [
				"job-delivery",
			],
			config: producerConfig,
			nowMs: 1500,
			save: producerSave,
		});

		expect(producerResult.issues).toEqual([
			expect.objectContaining({
				code: "producer_delivery_before_ready",
			}),
		]);

		const craftConfig = createEngineCraftTableTestConfig();
		const craftSave = cloneSave(
			runInitialSave({
				config: craftConfig,
				nowMs: 0,
			}),
		);
		craftSave.craftJobs["job:craft"] = {
			delivery: {
				lastBlockedAtMs: 999,
				nextAttemptAtMs: 2000,
			},
			id: "job:craft",
			recipeId: "item:craft-table",
			readyAtMs: 1000,
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const craftResult = runWorldValidation({
			checks: [
				"job-delivery",
			],
			config: craftConfig,
			nowMs: 1500,
			save: craftSave,
		});

		expect(craftResult.issues).toEqual([
			expect.objectContaining({
				code: "craft_delivery_before_ready",
			}),
		]);
	});

	it("can validate the adapter live state without mutating the snapshot", async () => {
		const adapter = await RuntimeGameEngineAdapter.create({
			config: createEngineTestConfig(),
			nowMs: 0,
			random: TestRandomService,
		});
		await adapter.dispatch({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			nowMs: 0,
		});

		const before = adapter.readSnapshot().save;
		const report = await adapter.validateSnapshot({
			nowMs: 500,
		});

		expect(report.issues).toEqual([]);
		expect(report.facts.producerJobs).toMatchObject([
			{
				status: "running",
			},
		]);
		expect(adapter.readSnapshot().save).toBe(before);
	});
});
