import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { GameSaveConfigSchema } from "~/v0/game/engine/model/GameSaveSchema";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";
import {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

describe("applyGameActionFx Producer", () => {
	it("starts a no-input producer product as an Effect action", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startAtMs: 500,
		});
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startAtMs: 500,
				type: "product.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("rolls producer output from currently active effects at completion", () => {
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
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productIds: [
									"product:test",
								],
							},
						},
					],
					scope: "global",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					durationMs: 1000,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:replace-output"] = {
			endAtMs: 750,
			effectId: "effect:replace-output",
			id: "effect-instance:replace-output",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);

		const completed = runTick({
			config,
			nowMs: 1500,
			save: started.save,
		});

		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					productId: "product:test",
					type: "product.completed",
				}),
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
				expect.objectContaining({
					type: "effect.expired",
				}),
			]),
		);
		expect(completed.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:plank",
					type: "item.created",
				}),
			]),
		);
	});

	it("does not keep consumed input loot effects after producer input consumption", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:key-replaces-output": {
					name: "Key replaces output",
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
									"product:shred",
								],
							},
						},
					],
					scope: "global",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:key": {
					...baseConfig.items["item:key"],
					passiveEffectIds: [
						"effect:key-replaces-output",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:key",
							quantity: 1,
						},
					],
					output: [
						{
							itemId: "item:twig",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:key",
			quantity: 1,
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(result.save.inventory.slots[0]).toBeNull();
	});

	it("rejects queued producer start when a block effect is active at queued start time", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-test": {
					name: "Block test",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productIds: [
									"product:test",
								],
							},
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
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:block-test"] = {
			endAtMs: 1500,
			effectId: "effect:block-test",
			id: "effect-instance:block-test",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 500,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const second = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});

		expect(second._tag).toBe("Left");
		if (second._tag === "Left") {
			expect(second.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "blocked",
			});
		}
	});

	it("does not let consumed input effects block their own producer start", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:twig-blocks-shred": {
					name: "Twig blocks shred",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productIds: [
									"product:shred",
								],
							},
						},
					],
					scope: "global",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					passiveEffectIds: [
						"effect:twig-blocks-shred",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(Object.values(result.save.producerJobs)).toHaveLength(1);
		expect(result.save.inventory.slots[0]).toBeNull();
	});

	it("rechecks producer requirements after auto-filled inputs are consumed", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					requirementIds: [
						"requirement:near-twig",
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
						itemId: "item:twig",
						x: 1,
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

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "missing_requirement",
			});
		}
		expect(save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:twig",
		});
	});

	it("keeps queued producer start times in configured FIFO order", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:early-replace-output": {
					name: "Early replace output",
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
									"product:test",
								],
							},
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
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:early-replace-output"] = {
			endAtMs: 500,
			effectId: "effect:early-replace-output",
			id: "effect-instance:early-replace-output",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const second = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});

		const jobs = Object.values(second.save.producerJobs).sort(
			(left, right) => left.startAtMs - right.startAtMs,
		);
		expect(jobs.map((job) => job.startAtMs)).toEqual([
			0,
			1000,
		]);
	});

	it("rejects queued producer start when the product line is hidden at queued start time", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:hide-test": {
					name: "Hide test",
					operations: [
						{
							kind: "line.hide",
							target: {
								productIds: [
									"product:test",
								],
							},
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
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:hide-test"] = {
			endAtMs: 2000,
			effectId: "effect:hide-test",
			id: "effect-instance:hide-test",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 1000,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const second = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});

		expect(second).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			},
		});
	});

	it("starts active effect product lines as timed producer jobs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test": {
					name: "Test effect",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productIds: [
									"product:shred",
								],
							},
						},
					],
					scope: "global",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					activatesEffectId: "effect:test",
					output: undefined,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const activeEffect = readOnlyRecordValue(result.save.activeEffects);
		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startAtMs: 500,
		});
		expect(activeEffect).toMatchObject({
			startAtMs: 500,
			effectId: "effect:test",
			endAtMs: 1500,
			producerJobId: job.id,
			sourceItemInstanceId: "item-instance:1",
		});
		expect(activeEffect.id).toMatch(/^effect-instance:/);
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startAtMs: 500,
				type: "product.started",
			},
			{
				atMs: 500,
				startAtMs: 500,
				effectId: "effect:test",
				endAtMs: 1500,
				id: activeEffect.id,
				producerJobId: job.id,
				sourceItemInstanceId: "item-instance:1",
				type: "effect.activated",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("rejects default producer product action when no default line is selected", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("rejects hidden producer product lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					visibility: "hidden",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("starts the saved default producer product line when productId is omitted", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:shred",
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save: {
				...save,
				board: {
					items: {
						...save.board.items,
						"item-instance:2": {
							id: "item-instance:2",
							itemId: "item:twig",
							x: 1,
							y: 0,
						},
					},
				},
			},
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				productId: "product:shred",
				type: "product.started",
			}),
		);
	});

	it("accepts producer proximity requirements from diagonal neighbors", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 2,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					requirementIds: [
						"requirement:near-twig",
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
						itemId: "item:twig",
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

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
	});

	it("slows product duration by nearest satisfied producer proximity distance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 2,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					requirementIds: [
						"requirement:near-twig",
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
						itemId: "item:twig",
						x: 2,
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

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 2500,
			startAtMs: 500,
		});
		expect(result.nextWakeAtMs).toBe(2500);
	});

	it("pauses a running producer while its proximity requirement source is out of range", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 2,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					requirementIds: [
						"requirement:near-twig",
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
						itemId: "item:twig",
						x: 2,
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

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 2000,
			startAtMs: 0,
		});

		const moved = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
			config,
			nowMs: 500,
			save: started.save,
		});

		expect(moved.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "product.completed",
				}),
			]),
		);
		expect(moved.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 500,
			readyAtMs: 2000,
			remainingMs: 1500,
			startAtMs: 0,
		});
		expect(moved.nextWakeAtMs).toBeNull();

		const stillPaused = runTick({
			config,
			nowMs: 2000,
			save: moved.save,
		});
		expect(stillPaused.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "product.completed",
				}),
			]),
		);
		expect(stillPaused.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 500,
			remainingMs: 1500,
		});
		expect(stillPaused.nextWakeAtMs).toBeNull();

		const resumed = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
			config,
			nowMs: 2500,
			save: stillPaused.save,
		});
		expect(resumed.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 4000,
			startAtMs: 2000,
		});
		expect(resumed.save.producerJobs[job.id]?.pausedAtMs).toBeUndefined();
		expect(resumed.save.producerJobs[job.id]?.remainingMs).toBeUndefined();
		expect(resumed.nextWakeAtMs).toBe(4000);
	});

	it("keeps already queued producer jobs behind a newly paused head job until the head resumes", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:backup",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-twig",
					],
				},
				"product:backup": {
					durationMs: 1000,
					name: "Backup",
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
					requirementIds: [],
					tags: [],
					visibility: "visible",
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
						itemId: "item:twig",
						x: 1,
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

		const firstStarted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const queued = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:backup",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save: firstStarted.save,
		});

		const paused = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
			config,
			nowMs: 250,
			save: queued.save,
		});
		const pausedJobs = Object.values(paused.save.producerJobs).sort(
			(left, right) => left.startAtMs - right.startAtMs,
		);
		expect(pausedJobs).toHaveLength(2);
		expect(pausedJobs[0]).toMatchObject({
			pausedAtMs: 250,
			productId: "product:test",
			remainingMs: 750,
		});
		expect(pausedJobs[1]).toMatchObject({
			productId: "product:backup",
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(paused.nextWakeAtMs).toBeNull();
		expect(
			GameSaveConfigSchema.safeParse({
				config,
				save: paused.save,
			}).success,
		).toBe(true);

		const resumed = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: paused.save,
		});
		const resumedJobs = Object.values(resumed.save.producerJobs).sort(
			(left, right) => left.startAtMs - right.startAtMs,
		);
		expect(resumedJobs).toHaveLength(2);
		expect(resumedJobs[0]).toMatchObject({
			pausedAtMs: undefined,
			productId: "product:test",
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(resumedJobs[1]).toMatchObject({
			productId: "product:backup",
			readyAtMs: 3000,
			startAtMs: 2000,
		});
		expect(resumed.nextWakeAtMs).toBe(2000);
	});

	it("pauses a queued producer job when a block effect appears before its scheduled start", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-test": {
					name: "Block test",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productIds: [
									"product:test",
								],
							},
						},
					],
					scope: "global",
				},
			},
			items: {
				...baseConfig.items,
				"item:blocker": {
					assetId: "asset:test",
					description: "Blocker",
					maxStackSize: 1,
					name: "Blocker",
					passiveEffectIds: [
						"effect:block-test",
					],
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
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
		save.inventory.slots[0] = {
			itemId: "item:blocker",
			quantity: 1,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const queued = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});
		const blockedBeforeStart = runAction({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 500,
			save: queued.save,
		});

		const result = runTick({
			config,
			nowMs: 1000,
			save: blockedBeforeStart.save,
		});
		const remainingJob = readOnlyRecordValue(result.save.producerJobs);

		expect(remainingJob).toMatchObject({
			pausedAtMs: 1000,
			productId: "product:test",
			remainingMs: 1000,
			startAtMs: 1000,
		});
		expect(result.nextWakeAtMs).toBeNull();

		const blocker = findBoardItem(result.save, {
			itemId: "item:blocker",
			x: 1,
			y: 0,
		});
		expect(blocker).toBeDefined();
		if (!blocker) return;

		const resumed = runAction({
			action: {
				boardItemId: blocker.id,
				type: "board.item.stash",
			},
			config,
			nowMs: 1500,
			save: result.save,
		});
		const resumedJob = readOnlyRecordValue(resumed.save.producerJobs);
		expect(resumedJob).toMatchObject({
			pausedAtMs: undefined,
			readyAtMs: 2500,
			remainingMs: undefined,
			startAtMs: 1500,
		});
		expect(resumed.nextWakeAtMs).toBe(2500);
	});

	it("rejects starting another producer job behind a requirement-paused first job", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:backup",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-twig",
					],
				},
				"product:backup": {
					durationMs: 1000,
					name: "Backup",
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
					requirementIds: [],
					tags: [],
					visibility: "visible",
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
						itemId: "item:twig",
						x: 1,
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

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const paused = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
			config,
			nowMs: 250,
			save: started.save,
		});
		expect(readOnlyRecordValue(paused.save.producerJobs)).toMatchObject({
			pausedAtMs: 250,
		});

		const queued = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:backup",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save: paused.save,
		});

		expect(queued).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "producer_queue_full",
			},
		});
	});

	it("does not apply queued active effects while their job is blocked behind a paused queue head", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-test": {
					name: "Block test",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productIds: [
									"product:test",
								],
							},
						},
					],
					scope: "global",
				},
			},
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:gate",
						"product:blocker",
						"product:test",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:gate": {
					...baseConfig.products["product:test"],
					name: "Gate",
					output: undefined,
					requirementIds: [
						"requirement:near-twig",
					],
				},
				"product:blocker": {
					activatesEffectId: "effect:block-test",
					durationMs: 1000,
					name: "Blocker",
					output: undefined,
					placement: "board_then_inventory",
					requirementIds: [],
					tags: [],
					visibility: "visible",
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
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:producer",
						x: 4,
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

		const gateStarted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:gate",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const blockerQueued = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:blocker",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save: gateStarted.save,
		});
		expect(readOnlyRecordValue(blockerQueued.save.activeEffects)).toMatchObject({
			endAtMs: 2000,
			startAtMs: 1000,
		});

		const paused = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
			config,
			nowMs: 250,
			save: blockerQueued.save,
		});
		expect(paused.nextWakeAtMs).toBeNull();

		const secondProducerStart = runAction({
			action: {
				producerItemInstanceId: "item-instance:3",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 1500,
			save: paused.save,
		});

		expect(
			Object.values(secondProducerStart.save.producerJobs).some(
				(job) =>
					job.producerItemInstanceId === "item-instance:3" &&
					job.productId === "product:test",
			),
		).toBe(true);
	});

	it("pauses a running producer when the producer moves outside its proximity requirement", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					requirementIds: [
						"requirement:near-twig",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 0,
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

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const movedAway = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 4,
				y: 0,
			},
			config,
			nowMs: 250,
			save: started.save,
		});
		expect(movedAway.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 250,
			remainingMs: 750,
		});
		expect(movedAway.nextWakeAtMs).toBeNull();

		const staleTime = runTick({
			config,
			nowMs: 1000,
			save: movedAway.save,
		});
		expect(staleTime.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 250,
			remainingMs: 750,
		});
		expect(staleTime.events).toEqual([]);

		const movedBack = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: staleTime.save,
		});
		expect(movedBack.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(movedBack.nextWakeAtMs).toBe(2000);
	});

	it("does not expire active producer effects while their requirement-paused job is stopped", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test": {
					name: "Test effect",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productIds: [
									"product:shred",
								],
							},
						},
					],
					scope: "global",
				},
			},
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					activatesEffectId: "effect:test",
					output: undefined,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					requirementIds: [
						"requirement:near-twig",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 0,
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
		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);
		const activeEffect = readOnlyRecordValue(started.save.activeEffects);
		expect(activeEffect).toMatchObject({
			endAtMs: 1000,
			producerJobId: job.id,
			startAtMs: 0,
		});

		const paused = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 4,
				y: 0,
			},
			config,
			nowMs: 250,
			save: started.save,
		});
		expect(paused.nextWakeAtMs).toBeNull();

		const expiredWindow = runTick({
			config,
			nowMs: 1000,
			save: paused.save,
		});
		expect(expiredWindow.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "effect.expired",
				}),
			]),
		);
		expect(expiredWindow.save.activeEffects[activeEffect.id]).toBeDefined();

		const resumed = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: expiredWindow.save,
		});
		expect(resumed.save.activeEffects[activeEffect.id]).toMatchObject({
			endAtMs: 2000,
			startAtMs: 1000,
		});
		expect(resumed.nextWakeAtMs).toBe(2000);
	});

	it("averages producer and product proximity duration multipliers", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 2,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
				"requirement:near-rock": {
					distance: 1,
					durationFactor: 1,
					itemIds: [
						"item:rock",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					requirementIds: [
						"requirement:near-twig",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-rock",
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
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 0,
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

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			startAtMs: 0,
		});
	});

	it("stacks product duration penalties from every active proximity hindrance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					hinderedBy: [
						{
							distance: 2,
							durationFactor: 0.5,
							itemIds: [
								"item:twig",
							],
							type: "proximity",
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
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
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

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 0,
		});
	});

	it("stacks active passive hindrance duration penalties", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					hinderedBy: [
						{
							durationFactor: 1,
							itemId: "item:rock",
							quantity: 1,
							scope: "board_or_inventory",
							type: "passive",
						},
						{
							durationFactor: 0.5,
							itemId: "item:twig",
							quantity: 1,
							scope: "inventory",
							type: "passive",
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
				inventory: [
					{
						itemId: "item:twig",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 0,
		});
	});

	it("rejects missing product proximity requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 2,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-twig",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "missing_requirement",
			});
		}
	});

	it("consumes explicit inventory inputs at product start", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "product-input",
				type: "item.consumed",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("auto-fills missing producer input from the board before starting the product", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 0,
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("leaves an incomplete producer product idle when auto-fill finds no inputs", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toEqual([]);
	});

	it("auto-fills available producer inputs without starting an incomplete product", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:twig",
							quantity: 2,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({
			"item-instance:1": {
				productInputs: {
					"product:shred": {
						items: {
							"item:twig": 1,
						},
					},
				},
			},
		});
		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 0,
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
		]);
	});

	it("auto-fills only missing producer input when the product line is partially filled", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:twig",
							quantity: 2,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 2,
				previousQuantity: 1,
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("auto-fills missing producer input from inventory before starting the product", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("stores producer line input from inventory and later consumes it on product start", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const stored = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(stored.save.inventory.slots[0]).toBeNull();
		expect(stored.save.producerInputs).toEqual({
			"item-instance:1": {
				productInputs: {
					"product:shred": {
						items: {
							"item:twig": 1,
						},
					},
				},
			},
		});
		expect(stored.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "producer-input-store",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				productId: "product:shred",
				type: "producer_input.stored",
			},
		]);

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 200,
			save: stored.save,
		});

		expect(started.save.producerInputs).toEqual({});
		expect(started.events).toMatchObject([
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("withdraws an entire producer product-line input through board then inventory placement", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 3,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 2,
					},
				},
			},
		};

		const result = runAction({
			action: {
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				previousQuantity: 2,
				productId: "product:shred",
				quantity: 2,
				type: "producer_input.withdrawn",
			},
			{
				itemId: "item:twig",
				reason: "producer-input-withdraw",
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				itemId: "item:twig",
				reason: "producer-input-withdraw",
				to: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("keeps producer line input stored when withdraw placement is unavailable", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:rock",
			x: 1,
			y: 0,
		};
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.inventory.slots[1] = {
			itemId: "item:plank",
			quantity: 2,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(
			save.producerInputs["item-instance:1"]?.productInputs["product:shred"]?.items,
		).toEqual({
			"item:twig": 1,
		});
	});

	it("stores duplicate producer input into the saved default line before earlier lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:alt-shred",
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the default line before later matching lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the first product line with remaining capacity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the next product line after the default line is full", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("accepts passive requirements from inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:twig-passive": {
					itemId: "item:twig",
					quantity: 1,
					scope: "board_or_inventory",
					type: "passive",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:twig-passive",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
	});

	it("fails through the typed error channel when a passive requirement is missing", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:twig-passive": {
					itemId: "item:twig",
					quantity: 1,
					scope: "inventory",
					type: "passive",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:twig-passive",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "missing_requirement",
			});
		}
	});

	it("queues product jobs for the same producer instead of running them in parallel", () => {
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
		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		const queuedJobs = Object.values(second.save.producerJobs);
		expect(queuedJobs).toHaveLength(2);
		expect(queuedJobs.find((job) => job.startAtMs === 1500)).toMatchObject({
			readyAtMs: 2500,
		});
		expect(second.nextWakeAtMs).toBe(1500);
	});

	it("rejects producer product start when the producer queue is full", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		expect(second._tag).toBe("Left");
		if (second._tag === "Left") {
			expect(second.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "producer_queue_full",
			});
		}
	});

	it("stores a non-first producer product line as the runtime default", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const defaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(defaulted.save.producerLines).toEqual({
			"item-instance:1": {
				defaultProductId: "product:shred",
			},
		});
		expect(defaulted.events).toEqual([
			{
				atMs: 100,
				nextProductId: "product:shred",
				previousProductId: undefined,
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);

		const reset = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(reset.save.producerLines).toEqual({
			"item-instance:1": {
				defaultProductId: "product:test",
			},
		});
		expect(reset.events).toEqual([
			{
				atMs: 200,
				nextProductId: "product:test",
				previousProductId: "product:shred",
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);
	});

	it("unsets the runtime default when the selected producer product line is clicked again", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const defaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});
		const unset = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(unset.save.producerLines).toEqual({});
		expect(unset.events).toEqual([
			{
				atMs: 200,
				nextProductId: undefined,
				previousProductId: "product:test",
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);
	});
});
