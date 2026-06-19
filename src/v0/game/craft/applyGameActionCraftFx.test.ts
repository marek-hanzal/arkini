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

describe("applyGameActionFx Craft", () => {
	it("rejects starting another craft job on the same target", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const action = {
			recipeId: "craft:plank",
			targetItemInstanceId: "item-instance:1",
			type: "craft.start" as const,
		};
		const first = runAction({
			action,
			config,
			nowMs: 100,
			save,
		});

		const second = runActionEither({
			action,
			config,
			nowMs: 200,
			save: first.save,
		});

		expect(second._tag).toBe("Left");
		if (second._tag === "Left") {
			expect(second.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "craft_in_progress",
			});
		}
	});

	it("stores craft inputs gradually and starts only after required inputs are complete", () => {
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const firstDeposit = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "craft.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(firstDeposit.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(firstDeposit.save.craftInputs).toEqual({
			"item-instance:1": {
				items: {
					"item:twig": 1,
				},
			},
		});
		expect(firstDeposit.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "craft-input-store",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 0,
				type: "craft_input.stored",
			},
		]);

		const earlyStart = runActionEither({
			action: {
				recipeId: "craft:plank",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 150,
			save: firstDeposit.save,
		});
		expect(earlyStart._tag).toBe("Left");
		if (earlyStart._tag === "Left") {
			expect(earlyStart.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "input_unavailable",
			});
		}

		const secondDeposit = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "craft.input.store",
			},
			config,
			nowMs: 200,
			save: firstDeposit.save,
		});

		expect(secondDeposit.save.inventory.slots[0]).toBeNull();
		expect(secondDeposit.save.craftInputs["item-instance:1"]?.items).toEqual({
			"item:twig": 2,
		});

		const started = runAction({
			action: {
				recipeId: "craft:plank",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 300,
			save: secondDeposit.save,
		});

		expect(started.save.craftInputs).toEqual({});
		expect(readOnlyRecordValue(started.save.craftJobs)).toMatchObject({
			completesAtMs: 1300,
			recipeId: "craft:plank",
			targetItemInstanceId: "item-instance:1",
			startedAtMs: 300,
		});
		expect(started.events).toEqual([
			{
				completesAtMs: 1300,
				jobId: readOnlyRecordValue(started.save.craftJobs).id,
				recipeId: "craft:plank",
				startedAtMs: 300,
				targetItemInstanceId: "item-instance:1",
				type: "craft.started",
			},
		]);
	});

	it("withdraws one stored craft input through producer-style board placement", () => {
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 2,
			},
		};

		const result = runAction({
			action: {
				itemId: "item:twig",
				quantity: 1,
				targetItemInstanceId: "item-instance:1",
				type: "craft.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.craftInputs["item-instance:1"]?.items).toEqual({
			"item:twig": 1,
		});
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 2,
				quantity: 1,
				type: "craft_input.withdrawn",
			},
			{
				itemId: "item:twig",
				reason: "craft-input-withdraw",
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("keeps craft input stored when withdraw placement is unavailable", () => {
		const config = createEngineCraftTableTestConfig({
			boardItemCount: 2,
			noRecipeInputs: false,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.inventory.slots[1] = {
			itemId: "item:plank",
			quantity: 2,
		};
		save.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 1,
			},
		};

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				quantity: 1,
				targetItemInstanceId: "item-instance:1",
				type: "craft.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(save.craftInputs["item-instance:1"]?.items).toEqual({
			"item:twig": 1,
		});
	});

	it("blocks craft input withdraw after craft start", () => {
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 2,
			},
		};
		const started = runAction({
			action: {
				recipeId: "craft:plank",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				quantity: 1,
				targetItemInstanceId: "item-instance:1",
				type: "craft.input.withdraw",
			},
			config,
			nowMs: 200,
			save: started.save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "craft_in_progress",
			});
		}
	});
});
