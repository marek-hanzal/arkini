import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

describe("applyGameActionFx StoredRequirement", () => {
	it("stores product-line requirements on the producer item before product start", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:producer-axe": {
					capacity: 1,
					itemId: "item:axe",
					quantity: 1,
					type: "stored",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:producer-axe",
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
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const stocked = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.store",
			},
			config,
			nowMs: 100,
			save,
		});
		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 200,
			save: stocked.save,
		});

		expect(stocked.save.inventory.slots[0]).toBeNull();
		expect(stocked.save.storedRequirements["item-instance:1"]).toEqual({
			items: {
				"item:axe": 1,
			},
		});
		expect(stocked.events).toMatchObject([
			{
				itemId: "item:axe",
				reason: "stored-requirement-store",
				type: "item.consumed",
			},
			{
				itemId: "item:axe",
				nextQuantity: 1,
				previousQuantity: 0,
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.stored",
			},
		]);
		expect(started.events).toMatchObject([
			{
				productId: "product:test",
				type: "product.started",
			},
		]);
	});

	it("rejects producer products while stored requirements are missing", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:producer-axe": {
					capacity: 1,
					itemId: "item:axe",
					quantity: 1,
					type: "stored",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:producer-axe",
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

	it("withdraws stored requirements back into inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:producer-axe": {
					capacity: 1,
					itemId: "item:axe",
					quantity: 1,
					type: "stored",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:producer-axe",
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
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const stocked = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.store",
			},
			config,
			nowMs: 100,
			save,
		});

		const withdrawn = runAction({
			action: {
				itemId: "item:axe",
				quantity: 1,
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.withdraw",
			},
			config,
			nowMs: 200,
			save: stocked.save,
		});

		expect(withdrawn.save.storedRequirements).toEqual({});
		expect(withdrawn.save.inventory.slots[0]).toEqual({
			itemId: "item:axe",
			quantity: 1,
		});
		expect(withdrawn.events).toMatchObject([
			{
				itemId: "item:axe",
				nextQuantity: 0,
				previousQuantity: 1,
				type: "stored_requirement.withdrawn",
			},
			{
				itemId: "item:axe",
				reason: "stored-requirement-withdraw",
				type: "item.created",
			},
		]);
	});

	it("uses stash stored requirements from the stash item save state", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:stash-axe": {
					capacity: 1,
					itemId: "item:axe",
					quantity: 1,
					type: "stored",
				},
			},
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
				},
			},
			products: {
				...baseConfig.products,
				"product:stash": {
					...baseConfig.products["product:stash"],
					requirementIds: [
						"requirement:stash-axe",
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
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const stocked = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 1,
				},
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.store",
			},
			config,
			nowMs: 100,
			save,
		});
		const opened = runAction({
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
			nowMs: 200,
			save: stocked.save,
		});

		expect(stocked.save.storedRequirements["item-instance:1"]).toEqual({
			items: {
				"item:axe": 1,
			},
		});
		expect(opened.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					producerItemInstanceId: "item-instance:1",
					productId: "product:stash",
					type: "product.started",
				}),
			]),
		);
	});
});
