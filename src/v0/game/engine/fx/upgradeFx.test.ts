import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { applyGameActionFx } from "~/v0/game/engine/fx/applyGameActionFx";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { readActionReadinessFx } from "~/v0/game/engine/fx/readActionReadinessFx";
import { runGameTickFx } from "~/v0/game/engine/fx/runGameTickFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";

const runAction = (props: applyGameActionFx.Props) =>
	Effect.runSync(applyGameActionFx(props).pipe(withRandomService(TestRandomService)));
const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runReadiness = (props: readActionReadinessFx.Props) =>
	Effect.runSync(readActionReadinessFx(props));
const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

describe("upgrade runtime", () => {
	it("starts upgrade jobs by consuming the next tier cost", () => {
		const config = createEngineTestConfig({
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
						itemId: "item:key",
						quantity: 1,
					},
				],
			},
			upgrades: {
				"upgrade:test-speed": {
					code: "test-speed",
					description: "Test speed upgrade",
					name: "Test Speed",
					sort: 1,
					tiers: [
						{
							cost: [
								{
									itemId: "item:key",
									quantity: 1,
								},
							],
							durationMs: 600,
							effects: [
								{
									ms: -500,
									productId: "product:test",
									type: "product.duration.add",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				type: "upgrade.start",
				upgradeId: "upgrade:test-speed",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.save.upgradeJobs["job:1"]).toEqual({
			completesAtMs: 700,
			id: "job:1",
			startedAtMs: 100,
			tierIndex: 0,
			upgradeId: "upgrade:test-speed",
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:key",
				reason: "upgrade-cost",
				type: "item.consumed",
			},
			{
				completesAtMs: 700,
				tierIndex: 0,
				type: "upgrade.started",
				upgradeId: "upgrade:test-speed",
			},
		]);
		expect(result.nextWakeAtMs).toBe(700);
	});

	it("completes upgrade jobs and applies effects to future product starts", () => {
		const config = createEngineTestConfig({
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
						itemId: "item:key",
						quantity: 1,
					},
				],
			},
			upgrades: {
				"upgrade:test-speed": {
					code: "test-speed",
					description: "Test speed upgrade",
					name: "Test Speed",
					sort: 1,
					tiers: [
						{
							cost: [
								{
									itemId: "item:key",
									quantity: 1,
								},
							],
							durationMs: 600,
							effects: [
								{
									ms: -500,
									productId: "product:test",
									type: "product.duration.add",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const startedUpgrade = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				type: "upgrade.start",
				upgradeId: "upgrade:test-speed",
			},
			config,
			nowMs: 100,
			save,
		});

		const completedUpgrade = runTick({
			config,
			nowMs: 700,
			save: startedUpgrade.save,
		});
		const startedProduct = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 700,
			save: completedUpgrade.save,
		});

		expect(completedUpgrade.save.upgrades["upgrade:test-speed"]).toEqual({
			completedTiers: 1,
		});
		expect(completedUpgrade.events).toMatchObject([
			{
				tierIndex: 0,
				type: "upgrade.completed",
				upgradeId: "upgrade:test-speed",
			},
		]);
		expect(startedProduct.save.producerJobs["job:2"]).toMatchObject({
			completesAtMs: 1200,
			startedAtMs: 700,
		});
	});

	it("uses upgraded output tables for future product jobs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lootTables: {
				...baseConfig.lootTables,
				"loot:better": {
					name: "Better loot",
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
			upgrades: {
				"upgrade:test-loot": {
					code: "test-loot",
					description: "Test loot upgrade",
					name: "Test Loot",
					sort: 1,
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									productId: "product:test",
									tableId: "loot:better",
									type: "product.outputTable.set",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const startedUpgrade = runAction({
			action: {
				inputRefs: [],
				type: "upgrade.start",
				upgradeId: "upgrade:test-loot",
			},
			config,
			nowMs: 0,
			save,
		});
		const completedUpgrade = runTick({
			config,
			nowMs: 0,
			save: startedUpgrade.save,
		});
		const startedProduct = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: completedUpgrade.save,
		});
		const completedProduct = runTick({
			config,
			nowMs: 1000,
			save: startedProduct.save,
		});

		expect(startedProduct.save.producerJobs["job:2"]).toMatchObject({
			outputTableId: "loot:better",
		});
		expect(completedProduct.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:plank",
					type: "item.created",
				}),
			]),
		);
	});

	it("keeps already started sink product jobs as sinks after output upgrades", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lootTables: {
				...baseConfig.lootTables,
				"loot:better": {
					name: "Better loot",
					output: [
						{
							itemId: "item:plank",
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
						itemId: "item:twig",
						quantity: 1,
					},
				],
			},
			upgrades: {
				"upgrade:shred-output": {
					code: "shred-output",
					description: "Shred output",
					name: "Shred Output",
					sort: 1,
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									productId: "product:shred",
									tableId: "loot:better",
									type: "product.outputTable.set",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const startedSink = runAction({
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
			nowMs: 0,
			save,
		});
		const startedUpgrade = runAction({
			action: {
				inputRefs: [],
				type: "upgrade.start",
				upgradeId: "upgrade:shred-output",
			},
			config,
			nowMs: 0,
			save: startedSink.save,
		});
		const completedUpgrade = runTick({
			config,
			nowMs: 0,
			save: startedUpgrade.save,
		});
		const completedSink = runTick({
			config,
			nowMs: 1000,
			save: completedUpgrade.save,
		});

		expect(startedSink.save.producerJobs["job:1"]).toMatchObject({
			outputTableId: null,
		});
		expect(completedSink.events.some((event) => event.type === "item.created")).toBe(false);
		expect(completedSink.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					productId: "product:shred",
					type: "product.completed",
				}),
			]),
		);
	});

	it("uses upgraded producer queue size for future product starts", () => {
		const config = createEngineTestConfig({
			upgrades: {
				"upgrade:test-queue": {
					code: "test-queue",
					description: "Test queue upgrade",
					name: "Test Queue",
					sort: 1,
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									producerId: "producer:test",
									quantity: 1,
									type: "producer.maxQueueSize.add",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const startedUpgrade = runAction({
			action: {
				inputRefs: [],
				type: "upgrade.start",
				upgradeId: "upgrade:test-queue",
			},
			config,
			nowMs: 0,
			save,
		});
		const completedUpgrade = runTick({
			config,
			nowMs: 0,
			save: startedUpgrade.save,
		});

		const firstProduct = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: completedUpgrade.save,
		});
		const secondProduct = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: firstProduct.save,
		});

		expect(secondProduct.save.producerJobs["job:3"]).toMatchObject({
			completesAtMs: 2000,
			startedAtMs: 1000,
		});
	});

	it("uses upgraded input costs for future product starts", () => {
		const config = createEngineTestConfig({
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
						itemId: "item:twig",
						quantity: 2,
					},
				],
			},
			inputs: {
				"input:shred": {
					name: "Shred input",
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				},
			},
			upgrades: {
				"upgrade:expensive-shred": {
					code: "expensive-shred",
					description: "Expensive shred",
					name: "Expensive Shred",
					sort: 1,
					tiers: [
						{
							cost: [],
							durationMs: 0,
							effects: [
								{
									itemId: "item:twig",
									productId: "product:shred",
									quantity: 1,
									type: "product.input.quantity.add",
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const startedUpgrade = runAction({
			action: {
				inputRefs: [],
				type: "upgrade.start",
				upgradeId: "upgrade:expensive-shred",
			},
			config,
			nowMs: 0,
			save,
		});
		const completedUpgrade = runTick({
			config,
			nowMs: 0,
			save: startedUpgrade.save,
		});

		const readiness = runReadiness({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 2,
						slotIndex: 0,
					},
				],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			save: completedUpgrade.save,
		});

		expect(readiness).toEqual({
			type: "ready",
		});
	});
});
