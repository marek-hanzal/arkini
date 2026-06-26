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
			recipeId: "item:craft-table",
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

		const started = runAction({
			action: {
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 150,
			save: firstDeposit.save,
		});

		expect(started.save.inventory.slots[0]).toBeNull();

		expect(started.save.craftInputs).toEqual({});
		expect(readOnlyRecordValue(started.save.craftJobs)).toMatchObject({
			readyAtMs: 1150,
			recipeId: "item:craft-table",
			targetItemInstanceId: "item-instance:1",
			startAtMs: 150,
		});
		expect(started.events).toEqual([
			{
				from: {
					kind: "inventory",
					nextQuantity: 0,
					previousQuantity: 1,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "craft-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 2,
				previousQuantity: 1,
				quantity: 1,
				recipeId: "item:craft-table",
				atMs: 150,
				targetItemInstanceId: "item-instance:1",
				type: "craft_input.stored",
			},
			{
				atMs: 150,
				readyAtMs: 1150,
				jobId: readOnlyRecordValue(started.save.craftJobs).id,
				recipeId: "item:craft-table",
				startAtMs: 150,
				targetItemInstanceId: "item-instance:1",
				type: "craft.started",
			},
		]);
	});

	it("rejects craft input investment when an effect blocks the result item", () => {
		const baseConfig = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		config.effects["effect:block-plank"] = {
			name: "Block plank",
			operations: [
				{
					kind: "item.blockCreate",
					reason: "Plank creation is blocked.",
					target: {
						itemIds: [
							"item:plank",
						],
					},
				},
			],
			scope: "global",
		};
		config.items["item:key"] = {
			...baseConfig.items["item:key"],
			passiveEffectIds: [
				"effect:block-plank",
			],
		};
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:key",
			x: 1,
			y: 0,
		};
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runActionEither({
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

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "effect:block-create",
			},
		});
		expect(save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("does not let consumed input effects block their own craft start", () => {
		const baseConfig = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		config.effects["effect:twig-blocks-plank"] = {
			name: "Twig blocks plank",
			operations: [
				{
					kind: "item.blockCreate",
					reason: "Twig blocks plank creation.",
					target: {
						itemIds: [
							"item:plank",
						],
					},
				},
			],
			scope: "global",
			sourceScope: "inventory",
		};
		config.items["item:twig"] = {
			...baseConfig.items["item:twig"],
			passiveEffectIds: [
				"effect:twig-blocks-plank",
			],
		};
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
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(Object.values(result.save.craftJobs)).toHaveLength(1);
		expect(result.save.inventory.slots[0]).toBeNull();
	});

	it("rechecks craft passive requirements after auto-filled inputs are consumed", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:craft-table": {
					...baseConfig.craftRecipes["item:craft-table"],
					inputs: [
						{
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					requirements: [
						{
							itemId: "item:twig",
							quantity: 1,
							scope: "board",
							type: "passive",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
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
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 100,
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
				recipeId: "item:craft-table",
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
