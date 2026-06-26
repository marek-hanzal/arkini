import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { readActionReadinessFx } from "~/v0/game/engine/readActionReadinessFx";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runReadiness = (props: readActionReadinessFx.Props) =>
	Effect.runSync(readActionReadinessFx(props));

describe("readActionReadinessFx", () => {
	it("returns ready for a valid producer product action", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			save,
		});

		expect(readiness).toEqual({
			type: "ready",
		});
	});

	it("returns rejected readiness for default producer product action when no default is selected", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			reason: "invalid_actor",
			type: "rejected",
		});
	});

	it("returns ready for a producer product action that can auto-fill from inventory", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const readiness = runReadiness({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			save,
		});

		expect(readiness).toEqual({
			type: "ready",
		});
	});

	it("returns ready for a producer product action that can partially auto-fill later", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			save,
		});

		expect(readiness).toEqual({
			type: "ready",
		});
	});

	it("ignores expired active effects while reading producer start readiness", () => {
		const config = createEngineTestConfig({
			effects: {
				"effect:block-product": {
					name: "Block product",
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
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:1"] = {
			startAtMs: 0,
			effectId: "effect:block-product",
			endAtMs: 1000,
			id: "effect-instance:1",
			sourceItemInstanceId: "item-instance:1",
		};

		const readiness = runReadiness({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 1001,
			save,
		});

		expect(readiness).toEqual({
			type: "ready",
		});
	});

	it("returns rejected readiness when the producer queue is full", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			outputTableId: "loot:test",
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startAtMs: 0,
		};

		const readiness = runReadiness({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			errorTag: "GameActionRejected",
			reason: "producer_queue_full",
			type: "rejected",
		});
	});

	it("returns rejected readiness when craft is already in progress on the target", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			recipeId: "craft:plank",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const readiness = runReadiness({
			action: {
				recipeId: "craft:plank",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			errorTag: "GameActionRejected",
			reason: "craft_in_progress",
			type: "rejected",
		});
	});

	it("returns rejected readiness for invalid action shape", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				type: "human.nonsense",
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			errorTag: "GameActionInvalid",
			type: "rejected",
		});
	});

	it("returns ready for stash open without rolling random loot", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:stash",
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
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				stashItemInstanceId: "item-instance:1",
				type: "stash.open",
			},
			config,
			save,
		});

		expect(readiness).toEqual({
			type: "ready",
		});
	});

	it("returns ready for stash partial auto-fill readiness", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:key",
							quantity: 2,
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
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
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				inputRefs: [],
				stashItemInstanceId: "item-instance:1",
				type: "stash.open",
			},
			config,
			save,
		});

		expect(readiness).toEqual({
			type: "ready",
		});
	});

	it("does not mutate save while reading readiness", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const before = structuredClone(save);

		runReadiness({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			save,
		});

		expect(save).toEqual(before);
	});
	it("rejects board item move readiness when target cell is occupied", () => {
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

		const readiness = runReadiness({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			errorTag: "GameActionRejected",
			reason: "unsupported_target",
			type: "rejected",
		});
	});

	it("rejects inventory item placement readiness from an empty slot", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			errorTag: "GameActionRejected",
			reason: "input_unavailable",
			type: "rejected",
		});
	});

	it("rejects board stash readiness when inventory cannot accept the item", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:axe",
			quantity: 1,
		};
		save.inventory.slots[1] = {
			itemId: "item:rock",
			quantity: 1,
		};

		const readiness = runReadiness({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			errorTag: "GameActionRejected",
			reason: "inventory:full",
			type: "rejected",
		});
	});

	it("rejects inventory slot swap readiness outside inventory bounds", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const readiness = runReadiness({
			action: {
				sourceSlotIndex: 0,
				targetSlotIndex: 99,
				type: "inventory.slots.swap",
			},
			config,
			save,
		});

		expect(readiness).toMatchObject({
			errorTag: "GameActionRejected",
			reason: "unsupported_target",
			type: "rejected",
		});
	});
});
