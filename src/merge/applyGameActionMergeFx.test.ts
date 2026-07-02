import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/engine/test/TestRandomService";
import {
	runAction,
	runActionEither,
	runActionWithRandom,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";

const NoChanceRandomService = {
	...TestRandomService,
	chance() {
		return false;
	},
};

const createForestMergeTestConfig = () => {
	const baseConfig = createEngineTestConfig();

	return createEngineTestConfig({
		items: {
			...baseConfig.items,
			"item:water": {
				assetIds: [
					"asset:test",
				],
				description: "Water",
				maxStackSize: 3,
				merges: [
					{
						output: [
							{
								type: "chance",
								itemId: "item:seed",
								quantity: 1,
								chance: 0.35,
							},
						],
						targetMode: "keep",
						withItemId: "item:micro-forest",
					},
				],
				name: "Water",
				storage: "both",
				tags: [],
				tier: 0,
			},
			"item:micro-forest": {
				assetIds: [
					"asset:test",
				],
				description: "Micro Forest",
				maxStackSize: 1,
				name: "Micro Forest",
				storage: "both",
				tags: [],
				tier: 0,
			},
			"item:seed": {
				assetIds: [
					"asset:test",
				],
				description: "Seed",
				maxStackSize: 3,
				name: "Seed",
				storage: "both",
				tags: [],
				tier: 0,
			},
		},

		startingState: {
			board: [
				{
					itemId: "item:water",
					x: 0,
					y: 0,
				},
				{
					itemId: "item:micro-forest",
					x: 1,
					y: 0,
				},
			],
			inventory: [],
		},
	});
};

describe("applyGameActionFx merge", () => {
	it("merges only source-owned explicit combo rules", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:water": {
					assetIds: [
						"asset:test",
					],
					description: "Water",
					maxStackSize: 3,
					merges: [
						{
							resultItemId: "item:plank",
							withItemId: "item:twig",
						},
					],
					name: "Water",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},

			startingState: {
				board: [
					{
						itemId: "item:water",
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

		const waterIntoTwig = runAction({
			action: {
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:1",
				},
				targetItemInstanceId: "item-instance:2",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(waterIntoTwig.save.board.items["item-instance:1"]).toBeUndefined();
		expect(waterIntoTwig.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:plank",
		});

		const freshSave = runInitialSave({
			config,
			nowMs: 0,
		});
		const twigIntoWater = runActionEither({
			action: {
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:2",
				},
				targetItemInstanceId: "item-instance:1",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save: freshSave,
		});

		expect(twigIntoWater._tag).toBe("Left");
	});

	it("merges an inventory source into a board target", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:twig",
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
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				sourceRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:plank",
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "merge-source",
				type: "item.consumed",
			},
			{
				fromItemId: "item:twig",
				reason: "merge-result",
				toItemId: "item:plank",
				type: "item.replaced",
			},
		]);
	});

	it("keeps the target and places chance output when a keep-target merge roll wins", () => {
		const config = createForestMergeTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:1",
				},
				targetItemInstanceId: "item-instance:2",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toBeUndefined();
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:micro-forest",
		});
		expect(Object.values(result.save.board.items)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:seed",
					x: 0,
					y: 0,
				}),
			]),
		);
		expect(result.events).toMatchObject([
			{
				itemId: "item:water",
				reason: "merge-source",
				type: "item.consumed",
			},
			{
				itemId: "item:seed",
				reason: "merge-output",
				type: "item.created",
			},
		]);
	});

	it("keeps the target and creates no output when a keep-target merge roll loses", () => {
		const config = createForestMergeTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionWithRandom(
			{
				action: {
					sourceRef: {
						kind: "board",
						itemInstanceId: "item-instance:1",
					},
					targetItemInstanceId: "item-instance:2",
					type: "item.merge",
				},
				config,
				nowMs: 100,
				save,
			},
			NoChanceRandomService,
		);

		expect(result.save.board.items["item-instance:1"]).toBeUndefined();
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:micro-forest",
		});
		expect(Object.values(result.save.board.items)).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:seed",
				}),
			]),
		);
		expect(result.events).toMatchObject([
			{
				itemId: "item:water",
				reason: "merge-source",
				type: "item.consumed",
			},
		]);
	});

	it("rejects merging into a target with preservable runtime state", () => {
		const baseConfig = createEngineCraftTableTestConfig({
			boardItemCount: 2,
			noRecipeInputs: false,
		});
		const config = createEngineTestConfig({
			...baseConfig,
			items: {
				...baseConfig.items,
				"item:craft-table": {
					...baseConfig.items["item:craft-table"],
					merges: [
						{
							resultItemId: "item:plank",
							withItemId: "item:craft-table",
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
						itemId: "item:craft-table",
						x: 1,
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
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const stored = runAction({
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
		expect(stored.save.craftInputs["item-instance:1"]).toMatchObject({
			items: {
				"item:twig": 1,
			},
		});

		const result = runActionEither({
			action: {
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:2",
				},
				targetItemInstanceId: "item-instance:1",
				type: "item.merge",
			},
			config,
			nowMs: 200,
			save: stored.save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "item_busy",
			},
		});
		expect(stored.save.craftInputs["item-instance:1"]).toMatchObject({
			items: {
				"item:twig": 1,
			},
		});
	});

	it("rejects merging into a target with a running craft job", () => {
		const baseConfig = createEngineCraftTableTestConfig({
			noRecipeInputs: true,
		});
		const config = createEngineTestConfig({
			...baseConfig,
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					merges: [
						{
							resultItemId: "item:plank",
							withItemId: "item:craft-table",
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
		save.craftJobs["job:1"] = {
			readyAtMs: 1000,
			id: "job:1",
			recipeId: "item:craft-table",
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const result = runActionEither({
			action: {
				sourceRef: {
					kind: "board",
					itemInstanceId: "item-instance:2",
				},
				targetItemInstanceId: "item-instance:1",
				type: "item.merge",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "item_busy",
			},
		});
	});
});
