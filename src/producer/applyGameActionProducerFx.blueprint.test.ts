import { describe, expect, it } from "vitest";
import {
	createEngineTestConfig,
	runAction,
	runActionEither,
	runInitialSave,
} from "./applyGameActionProducerFx.testSupport";

describe("applyGameActionFx Producer blueprint", () => {
	it("rejects blueprint producer output when the crafted target is already at maxCount", () => {
		const baseConfig = createEngineTestConfig();
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
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 1,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					output: [
						{
							type: "guaranteed",
							quantity: 1,
							itemId: "item:plank",
						},
					],
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:blueprint-plank",
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
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:max-count",
			},
		});
	});

	it("rejects blueprint producer output when the crafted target is reserved by an existing blueprint", () => {
		const baseConfig = createEngineTestConfig();
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
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					output: [
						{
							type: "guaranteed",
							quantity: 1,
							itemId: "item:plank",
						},
					],
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:blueprint-plank",
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
					{
						itemId: "item:blueprint-plank",
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
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:max-count",
			},
		});
	});

	it("rejects blueprint producer output when the crafted target is reserved by an inventory blueprint", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					output: [
						{
							type: "guaranteed",
							quantity: 1,
							itemId: "item:plank",
						},
					],
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:blueprint-plank",
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
						itemId: "item:blueprint-plank",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:max-count",
			},
		});
	});

	it("rejects blueprint producer output when an existing producer job already reserves the crafted target", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					output: [
						{
							type: "guaranteed",
							quantity: 1,
							itemId: "item:plank",
						},
					],
				},
			},
			producerOverrides: {
				"item:producer": {
					maxQueueSize: 2,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					durationMs: 1000,
					output: [
						{
							itemId: "item:blueprint-plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const second = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 200,
			save: first.save,
		});

		expect(second).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:max-count",
			},
		});
	});

	it("rejects producer start while the same target has a running craft job", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:producer": {
					durationMs: 1000,
					inputs: [],
					output: [
						{
							type: "guaranteed",
							quantity: 1,
							itemId: "item:plank",
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const crafting = runAction({
			action: {
				recipeId: "item:producer",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 200,
			save: crafting.save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "item_busy",
			},
		});
		expect(Object.values(crafting.save.craftJobs)).toHaveLength(1);
	});
});
