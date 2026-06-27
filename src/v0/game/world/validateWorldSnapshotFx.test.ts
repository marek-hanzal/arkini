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
	it("normalizes paused producer queues, blocked queued jobs and their active effects", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:queued": {
					name: "Queued effect",
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
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:queued",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:queued": {
					activatesEffectId: "effect:queued",
					durationMs: 1000,
					name: "Queued",
					placement: "board_then_inventory",
					requirementIds: [],
					tags: [],
					visibility: "visible",
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
		save.producerJobs["job:queued"] = {
			id: "job:queued",
			producerItemInstanceId: "item-instance:1",
			productId: "product:queued",
			readyAtMs: 2000,
			startAtMs: 1000,
		};
		save.activeEffects["effect-instance:queued"] = {
			effectId: "effect:queued",
			endAtMs: 2000,
			id: "effect-instance:queued",
			producerJobId: "job:queued",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 1000,
		};

		const facts = runWorldFacts({
			config,
			nowMs: 1500,
			save,
		});

		expect(
			facts.producerJobs.map((producerJobFacts) => ({
				id: producerJobFacts.job.id,
				releaseAtMs: producerJobFacts.releaseAtMs,
				status: producerJobFacts.status,
			})),
		).toEqual([
			{
				id: "job:paused",
				releaseAtMs: undefined,
				status: "paused",
			},
			{
				id: "job:queued",
				releaseAtMs: undefined,
				status: "blocked_by_paused_queue_head",
			},
		]);
		expect(facts.activeEffects).toMatchObject([
			{
				effect: {
					id: "effect-instance:queued",
				},
				status: "blocked_by_paused_queue_head",
			},
		]);
		expect(facts.wakePlan.wakeReasons).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entity: {
						id: "job:queued",
						kind: "producerJob",
					},
				}),
			]),
		);
	});

	it("normalizes producer requirement failures in the same snapshot report", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			items: {
				...baseConfig.items,
				"item:tree": {
					assetId: "asset:test",
					description: "Tree",
					maxStackSize: 1,
					name: "Tree",
					tags: [],
					tier: 0,
					storage: "both",
				},
			},
			requirements: {
				"requirement:near-tree": {
					distance: 1,
					itemIds: [
						"item:tree",
					],
					type: "proximity",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-tree",
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
						itemId: "item:tree",
						x: 3,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:producer"] = {
			id: "job:producer",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};

		const facts = runWorldFacts({
			config,
			nowMs: 500,
			save,
		});

		expect(facts.producerRequirements).toMatchObject([
			{
				jobId: "job:producer",
				ready: false,
				requirements: [
					{
						matchedDistance: 3,
						requiredDistance: 1,
						status: "out_of_range",
					},
				],
			},
		]);
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
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:producer": {
					durationMs: 1000,
					inputs: [],
					requirements: [],
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
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
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
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
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

	it("can validate the adapter live state without mutating the snapshot", async () => {
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
