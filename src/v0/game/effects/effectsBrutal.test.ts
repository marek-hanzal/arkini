import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";
import {
	findBoardItem,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

const startProducer = ({
	config,
	nowMs,
	producerItemInstanceId,
	productId = "product:test",
	save,
}: {
	config: Parameters<typeof runAction>[0]["config"];
	nowMs: number;
	producerItemInstanceId: string;
	productId?: string;
	save: Parameters<typeof runAction>[0]["save"];
}) =>
	runAction({
		config,
		nowMs,
		save,
		action: {
			inputRefs: [],
			producerItemInstanceId,
			productId,
			type: "producer.product.start",
		},
	});

const readSingleProducerJob = (save: Parameters<typeof startProducer>[0]["save"]) => {
	const jobs = Object.values(save.producerJobs);
	if (jobs.length !== 1) throw new Error(`Expected one producer job, got ${jobs.length}.`);
	const [job] = jobs;
	if (!job) throw new Error("Missing producer job.");
	return job;
};

const createInventorySelfBlockConfig = ({ quantity }: { quantity: number }) => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:inventory-self-block": {
				name: "Inventory self block",
				operations: [
					{
						kind: "item.blockCreate",
						reason: "inventory axe blocks axe creation",
						target: {
							items: {
								anyOf: [
									{
										ids: [
											"item:axe",
										],
									},
								],
							},
						},
					},
				],
				scope: "global",
				sourceScope: "inventory",
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 2,
			},
			inventory: {
				slots: 1,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				maxStackSize: Math.max(baseConfig.items["item:axe"].maxStackSize, quantity),
				passiveEffectIds: [
					"effect:inventory-self-block",
				],
			},
		},
		startingState: {
			board: [],
			inventory: [
				{
					itemId: "item:axe",
					quantity,
				},
			],
		},
	});
};

const createInventoryOnlySpeedConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:inventory-speed": {
				name: "Inventory-only speed",
				operations: [
					{
						kind: "duration.multiply",
						multiplier: 0.1,
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:test",
										],
									},
								],
							},
						},
					},
				],
				scope: "global",
				sourceScope: "inventory",
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 4,
			},
			inventory: {
				slots: 1,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:inventory-speed",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 1000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
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
			],
			inventory: [
				{
					itemId: "item:axe",
					quantity: 1,
				},
			],
		},
	});
};

const createStackedInventorySpeedConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:inventory-half-speed": {
				name: "Inventory half speed",
				operations: [
					{
						kind: "duration.multiply",
						multiplier: 0.5,
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:test",
										],
									},
								],
							},
						},
					},
				],
				scope: "global",
				sourceScope: "inventory",
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 4,
			},
			inventory: {
				slots: 1,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				maxStackSize: 2,
				passiveEffectIds: [
					"effect:inventory-half-speed",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 1000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
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
			],
			inventory: [
				{
					itemId: "item:axe",
					quantity: 2,
				},
			],
		},
	});
};

const createBoardSpeedConfig = ({ sourceScope }: { sourceScope?: "both" }) => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:board-speed": {
				name: "Board speed",
				operations: [
					{
						kind: "duration.multiply",
						multiplier: 0.1,
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:test",
										],
									},
								],
							},
						},
					},
				],
				scope: "global",
				...(sourceScope
					? {
							sourceScope,
						}
					: {}),
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 3,
			},
			inventory: {
				slots: 1,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:board-speed",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 1000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
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
					itemId: "item:axe",
					x: 1,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

const createActiveEffectConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:active-speed": {
				name: "Active speed window",
				operations: [
					{
						kind: "duration.multiply",
						multiplier: 0.1,
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:test",
										],
									},
								],
							},
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
				width: 3,
			},
			inventory: {
				slots: 2,
			},
		},
		producers: {
			...baseConfig.producers,
			"item:producer": {
				...baseConfig.producers["item:producer"],
				productIds: [
					"product:activate-speed",
					"product:test",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:activate-speed": {
				activatesEffectId: "effect:active-speed",
				chargeCost: 0,
				durationMs: 500,
				name: "Activate speed",
				placement: "board_then_inventory",
				tags: [],
				visibility: "visible",
			},
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 10_000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
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
					itemId: "item:producer",
					x: 1,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

const createLocalLootAppendConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:nearby-extra-plank": {
				name: "Nearby extra plank",
				operations: [
					{
						chance: 1,
						kind: "loot.appendOutput",
						output: [
							{
								itemId: "item:plank",
								quantity: 1,
								type: "guaranteed",
							},
						],
						target: {
							productLines: {
								anyOf: [
									{
										ids: [
											"product:test",
										],
									},
								],
							},
						},
					},
				],
				radius: 1,
				scope: "local",
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 4,
			},
			inventory: {
				slots: 2,
			},
		},
		items: {
			...baseConfig.items,
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:nearby-extra-plank",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 1000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
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
					itemId: "item:axe",
					x: 3,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

const createLocalBlockCreateConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		effects: {
			"effect:nearby-no-twigs": {
				name: "Nearby no twigs",
				operations: [
					{
						kind: "item.blockCreate",
						reason: "twigs blocked near axe",
						target: {
							items: {
								anyOf: [
									{
										ids: [
											"item:twig",
										],
									},
								],
							},
						},
					},
				],
				radius: 1,
				scope: "local",
			},
		},
		game: {
			...baseConfig.game,
			board: {
				height: 1,
				width: 4,
			},
			inventory: {
				slots: 1,
			},
		},
		items: {
			...baseConfig.items,
			"item:twig": {
				...baseConfig.items["item:twig"],
				storage: "board",
			},
			"item:axe": {
				...baseConfig.items["item:axe"],
				passiveEffectIds: [
					"effect:nearby-no-twigs",
				],
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 1000,
				output: [
					{
						itemId: "item:twig",
						quantity: 1,
						type: "guaranteed",
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
					itemId: "item:axe",
					x: 3,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

describe("brutal effect runtime integration", () => {
	it("does not let the inventory source being moved block its own board placement", () => {
		const config = createInventorySelfBlockConfig({
			quantity: 1,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const placed = runAction({
			config,
			nowMs: 100,
			save,
			action: {
				placementMode: "exact",
				quantity: 1,
				slotIndex: 0,
				type: "inventory.item.place",
				x: 0,
				y: 0,
			},
		});

		expect(placed.save.inventory.slots[0]).toBeNull();
		expect(
			findBoardItem(placed.save, {
				itemId: "item:axe",
				x: 0,
				y: 0,
			}),
		).toBeDefined();
	});

	it("keeps remaining inventory self-block sources active after one stack item is moved", () => {
		const config = createInventorySelfBlockConfig({
			quantity: 2,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			config,
			nowMs: 100,
			save,
			action: {
				placementMode: "exact",
				quantity: 1,
				slotIndex: 0,
				type: "inventory.item.place",
				x: 0,
				y: 0,
			},
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:block-create",
			});
		}
	});

	it("extends a running job when an inventory-only global source leaves inventory", () => {
		const config = createInventoryOnlySpeedConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:1",
			save,
		});
		const job = readSingleProducerJob(started.save);
		expect(job).toMatchObject({
			readyAtMs: 100,
			startAtMs: 0,
		});

		const placed = runAction({
			config,
			nowMs: 50,
			save: started.save,
			action: {
				placementMode: "exact",
				quantity: 1,
				slotIndex: 0,
				type: "inventory.item.place",
				x: 3,
				y: 0,
			},
		});

		expect(placed.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});
		expect(placed.nextWakeAtMs).toBe(1000);
	});

	it("recomputes stacked inventory sources when only one quantity leaves the stack", () => {
		const config = createStackedInventorySpeedConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:1",
			save,
		});
		const job = readSingleProducerJob(started.save);
		expect(job).toMatchObject({
			readyAtMs: 250,
			startAtMs: 0,
		});

		const placedOneSource = runAction({
			config,
			nowMs: 50,
			save: started.save,
			action: {
				placementMode: "exact",
				quantity: 1,
				slotIndex: 0,
				type: "inventory.item.place",
				x: 3,
				y: 0,
			},
		});

		expect(placedOneSource.save.inventory.slots[0]).toMatchObject({
			itemId: "item:axe",
			quantity: 1,
		});
		expect(placedOneSource.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 500,
			startAtMs: 0,
		});
		expect(placedOneSource.nextWakeAtMs).toBe(500);
	});

	it("extends a running job when a board-only global source is stashed", () => {
		const config = createBoardSpeedConfig({});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:1",
			save,
		});
		const job = readSingleProducerJob(started.save);
		expect(job.readyAtMs).toBe(100);
		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 1,
			y: 0,
		});
		expect(source).toBeDefined();

		const stashed = runAction({
			config,
			nowMs: 50,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.stash",
			},
		});

		expect(stashed.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});
		expect(stashed.nextWakeAtMs).toBe(1000);
	});

	it("keeps a both-scope global source active when it moves from board to inventory", () => {
		const config = createBoardSpeedConfig({
			sourceScope: "both",
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:1",
			save,
		});
		const job = readSingleProducerJob(started.save);
		expect(job.readyAtMs).toBe(100);
		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 1,
			y: 0,
		});
		expect(source).toBeDefined();

		const stashed = runAction({
			config,
			nowMs: 50,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.stash",
			},
		});

		expect(stashed.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 100,
			startAtMs: 0,
		});
		expect(stashed.nextWakeAtMs).toBe(100);
	});

	it("lets active producer effects speed up another producer, then extends it when the window expires", () => {
		const config = createActiveEffectConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const activated = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:1",
			productId: "product:activate-speed",
			save,
		});
		const activeJobId = Object.keys(activated.save.producerJobs)[0];
		expect(activeJobId).toBeDefined();
		expect(Object.values(activated.save.activeEffects)).toEqual([
			expect.objectContaining({
				effectId: "effect:active-speed",
				endAtMs: 500,
				producerJobId: activeJobId,
				startAtMs: 0,
			}),
		]);

		const spedUp = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:2",
			productId: "product:test",
			save: activated.save,
		});
		const affectedJob = Object.values(spedUp.save.producerJobs).find(
			(job) => job.productId === "product:test",
		);
		expect(affectedJob).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const expired = runTick({
			config,
			nowMs: 500,
			save: spedUp.save,
		});

		expect(expired.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId: activeJobId,
					type: "product.completed",
				}),
				expect.objectContaining({
					effectId: "effect:active-speed",
					type: "effect.expired",
				}),
			]),
		);
		expect(expired.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId: affectedJob?.id,
					type: "product.completed",
				}),
			]),
		);
		expect(expired.save.producerJobs[affectedJob?.id ?? "missing"]).toMatchObject({
			readyAtMs: 10_000,
			startAtMs: 0,
		});
		expect(expired.save.activeEffects).toEqual({});
		expect(expired.nextWakeAtMs).toBe(10_000);
	});

	it("rerolls live producer loot when a local append-output source enters proximity before completion", () => {
		const config = createLocalLootAppendConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:1",
			save,
		});
		const source = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 3,
			y: 0,
		});
		expect(source).toBeDefined();

		const movedIntoRange = runAction({
			config,
			nowMs: 500,
			save: started.save,
			action: {
				boardItemId: source?.id ?? "missing",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
		});
		const completed = runTick({
			config,
			nowMs: 1000,
			save: movedIntoRange.save,
		});

		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
				expect.objectContaining({
					itemId: "item:plank",
					type: "item.created",
				}),
			]),
		);
		expect(completed.save.producerJobs).toEqual({});
	});

	it("blocks live producer delivery with a moved local item.create blocker, then releases it on retry", () => {
		const config = createLocalBlockCreateConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = startProducer({
			config,
			nowMs: 0,
			producerItemInstanceId: "item-instance:1",
			save,
		});
		const job = readSingleProducerJob(started.save);
		const blocker = findBoardItem(started.save, {
			itemId: "item:axe",
			x: 3,
			y: 0,
		});
		expect(blocker).toBeDefined();

		const movedIntoBlockRange = runAction({
			config,
			nowMs: 500,
			save: started.save,
			action: {
				boardItemId: blocker?.id ?? "missing",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
		});
		const blocked = runTick({
			config,
			nowMs: 1000,
			save: movedIntoBlockRange.save,
		});

		expect(blocked.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId: job.id,
					reason: "effect:block-create",
					type: "product.blocked",
				}),
			]),
		);
		expect(blocked.save.producerJobs[job.id]).toMatchObject({
			delivery: {
				lastBlockedAtMs: 1000,
				nextAttemptAtMs: 2000,
			},
		});
		expect(
			findBoardItem(blocked.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeUndefined();

		const movedOutOfBlockRange = runAction({
			config,
			nowMs: 1999,
			save: blocked.save,
			action: {
				boardItemId: blocker?.id ?? "missing",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
		});
		const released = runTick({
			config,
			nowMs: 2000,
			save: movedOutOfBlockRange.save,
		});

		expect(released.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					jobId: job.id,
					type: "product.completed",
				}),
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
			]),
		);
		expect(released.save.producerJobs[job.id]).toBeUndefined();
		expect(
			findBoardItem(released.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
	});
});
