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

	it("rejects craft start when the result item board maxCount is reached", () => {
		const baseConfig = createEngineCraftTableTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
			},
			craftRecipes: baseConfig.craftRecipes,
			startingState: {
				board: [
					{
						itemId: "item:craft-table",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:plank",
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
				reason: "board:max-count",
			});
		}
	});

	it("rejects and surfaces craft start blockers from active effects", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:blocker": {
					grants: [
						{
							id: "grant:test:blocker",
							name: "Blocker",
						},
					],
					name: "Craft Blocker",
					polarity: "debuff",
					sourceScope: "board",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:test:blocker",
					],
				},
			},
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:craft-table": {
					...baseConfig.craftRecipes["item:craft-table"],
					effects: [
						{
							display: "whenActive",
							kind: "grant.blockStart",
							label: "Craft Blocker",
							reason: "Craft is blocked by a test effect.",
							selector: {
								allOf: [
									{
										ids: [
											"grant:test:blocker",
										],
									},
								],
							},
						},
					],
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
					{
						itemId: "item:axe",
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
				message: "Craft is blocked by a test effect.",
				reason: "blocked",
			});
		}
	});

	it("pauses running craft jobs when a start blocker becomes active", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:blocker": {
					grants: [
						{
							id: "grant:test:blocker",
							name: "Blocker",
						},
					],
					name: "Craft Blocker",
					polarity: "debuff",
					sourceScope: "board",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:test:blocker",
					],
				},
			},
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:craft-table": {
					...baseConfig.craftRecipes["item:craft-table"],
					effects: [
						{
							display: "whenActive",
							kind: "grant.blockStart",
							reason: "Craft is blocked by a test effect.",
							selector: {
								allOf: [
									{
										ids: [
											"grant:test:blocker",
										],
									},
								],
							},
						},
					],
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
			nowMs: 0,
			save,
		});
		started.save.board.items["item-instance:blocker"] = {
			createdAtMs: 250,
			id: "item-instance:blocker",
			itemId: "item:axe",
			x: 1,
			y: 0,
		};

		const paused = runTick({
			config,
			nowMs: 500,
			save: started.save,
		});
		const pausedJob = readOnlyRecordValue(paused.save.craftJobs);

		expect(pausedJob).toMatchObject({
			pausedAtMs: 500,
			readyAtMs: 1000,
			remainingMs: 500,
			startAtMs: 0,
		});

		delete paused.save.board.items["item-instance:blocker"];
		const resumed = runTick({
			config,
			nowMs: 700,
			save: paused.save,
		});
		const resumedJob = readOnlyRecordValue(resumed.save.craftJobs);

		expect(resumedJob).toMatchObject({
			readyAtMs: 1200,
			startAtMs: 200,
		});
		expect(resumedJob.pausedAtMs).toBeUndefined();
		expect(resumedJob.remainingMs).toBeUndefined();
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

	it("rejects craft start while the same target has a running producer job", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:producer": {
					durationMs: 1000,
					inputs: [],
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
