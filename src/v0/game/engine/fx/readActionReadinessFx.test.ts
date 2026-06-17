import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { readActionReadinessFx } from "~/v0/game/engine/fx/readActionReadinessFx";
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			save,
		});

		expect(save).toEqual(before);
	});
});
