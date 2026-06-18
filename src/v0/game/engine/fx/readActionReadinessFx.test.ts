import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { readActionReadinessFx } from "~/v0/game/engine/fx/readActionReadinessFx";
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

	it("returns rejected readiness for a missing producer input", () => {
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

		expect(readiness).toMatchObject({
			errorTag: "GameActionRejected",
			reason: "input_mismatch",
			type: "rejected",
		});
	});

	it("returns rejected readiness for disabled producer product lines", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			disabledProductIds: [
				"product:test",
			],
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
			reason: "product_line_disabled",
			type: "rejected",
		});
	});

	it("returns rejected readiness when the producer queue is full", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:1"] = {
			completesAtMs: 1000,
			id: "job:1",
			outputTableId: "loot:test",
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startedAtMs: 0,
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
			completesAtMs: 1000,
			id: "job:1",
			recipeId: "craft:plank",
			startedAtMs: 0,
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
});
