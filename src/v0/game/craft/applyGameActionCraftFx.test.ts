import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
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

	it("completes zero-duration craft jobs in the same action", () => {
		const baseConfig = createEngineCraftTableTestConfig();
		const config = createEngineTestConfig({
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:craft-table": {
					...baseConfig.craftRecipes["item:craft-table"],
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
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

		expect(result.save.craftJobs).toEqual({});
		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:plank",
			x: 0,
			y: 0,
		});
		expect(result.nextWakeAtMs).toBeNull();
		expect(result.events).toEqual([
			{
				atMs: 100,
				jobId: expect.any(String),
				readyAtMs: 100,
				recipeId: "item:craft-table",
				startAtMs: 100,
				targetItemInstanceId: "item-instance:1",
				type: "craft.started",
			},
			{
				atMs: 100,
				jobId: expect.any(String),
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.completed",
			},
			{
				atMs: 100,
				fromItemId: "item:craft-table",
				itemInstanceId: "item-instance:1",
				reason: "craft-result",
				toItemId: "item:plank",
				type: "item.replaced",
			},
		]);
	});

	it("does not let a craft target block its own replacement result", () => {
		const baseConfig = createEngineCraftTableTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:craft-table-blocks-plank": {
					name: "Craft table blocks plank",
					operations: [
						{
							kind: "item.blockCreate",
							reason: "Craft table blocks plank creation.",
							target: {
								items: {
									anyOf: [
										{
											ids: [
												"item:plank",
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
			items: {
				...baseConfig.items,
				"item:craft-table": {
					...baseConfig.items["item:craft-table"],
					passiveEffectIds: [
						"effect:craft-table-blocks-plank",
					],
				},
			},
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:craft-table": {
					...baseConfig.craftRecipes["item:craft-table"],
					inputs: [],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
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
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 100,
			save,
		});
		expect(readOnlyRecordValue(started.save.craftJobs)).toMatchObject({
			readyAtMs: 1100,
			recipeId: "item:craft-table",
			targetItemInstanceId: "item-instance:1",
		});

		const completed = runTick({
			config,
			nowMs: 1100,
			save: started.save,
		});

		expect(completed.save.craftJobs).toEqual({});
		expect(completed.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:plank",
			x: 0,
			y: 0,
		});
		expect(completed.events).toEqual([
			expect.objectContaining({
				type: "craft.completed",
			}),
			expect.objectContaining({
				fromItemId: "item:craft-table",
				toItemId: "item:plank",
				type: "item.replaced",
			}),
		]);
	});

	it("lets an instant craft result resync and complete a due producer in the same action", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:crafted-nearby-speed": {
					name: "Crafted nearby speed",
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
					radius: 1,
					scope: "local",
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
						"effect:crafted-nearby-speed",
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
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:craft-table": {
					...baseConfig.craftRecipes["item:craft-table"],
					durationMs: 0,
					inputs: [],
					resultItemId: "item:axe",
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
						itemId: "item:craft-table",
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
		const producing = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		expect(readOnlyRecordValue(producing.save.producerJobs)).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const result = runAction({
			action: {
				recipeId: "item:craft-table",
				targetItemInstanceId: "item-instance:2",
				type: "craft.start",
			},
			config,
			nowMs: 500,
			save: producing.save,
		});

		expect(result.save.craftJobs).toEqual({});
		expect(result.save.producerJobs).toEqual({});
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:axe",
			x: 1,
			y: 0,
		});
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 2,
				y: 0,
			}),
		).toBeDefined();
		expect(result.events).toEqual([
			expect.objectContaining({
				readyAtMs: 500,
				type: "craft.started",
			}),
			expect.objectContaining({
				type: "craft.completed",
			}),
			expect.objectContaining({
				fromItemId: "item:craft-table",
				toItemId: "item:axe",
				type: "item.replaced",
			}),
			expect.objectContaining({
				productId: "product:test",
				type: "product.completed",
			}),
			expect.objectContaining({
				itemId: "item:twig",
				reason: "product-output",
				type: "item.created",
			}),
		]);
	});

	it("rejects craft start while the same target has a running producer job", () => {
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
			startingState: {
				board: [
					{
						itemId: "item:producer",
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
		const producing = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const result = runActionEither({
			action: {
				recipeId: "item:producer",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 200,
			save: producing.save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "item_busy",
			},
		});
		expect(Object.values(producing.save.producerJobs)).toHaveLength(1);
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
						items: {
							anyOf: [
								{
									ids: [
										"item:plank",
									],
								},
							],
						},
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
						items: {
							anyOf: [
								{
									ids: [
										"item:plank",
									],
								},
							],
						},
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
