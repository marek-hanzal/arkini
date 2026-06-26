import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { GameSaveConfigSchema, type GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const createInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

const cloneSave = (save: GameSave): GameSave => structuredClone(save);

const createProducerJob = (id: string) => ({
	readyAtMs: 1000,
	id,
	outputItems: [
		{
			itemId: "item:twig",
			quantity: 2,
		},
	],
	productId: "product:test",
	producerItemInstanceId: "item-instance:1",
	startAtMs: 0,
});

const createCraftJob = (id: string, targetItemInstanceId: string) => ({
	readyAtMs: 1000,
	id,
	recipeId: "item:craft-table",
	startAtMs: 0,
	targetItemInstanceId,
});

describe("GameSaveConfigSchema", () => {
	it("accepts a valid save for its config", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});

		expect(() =>
			GameSaveConfigSchema.parse({
				config,
				save,
			}),
		).not.toThrow();
	});

	it("rejects board item counts above item maxCount", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
				},
				board: {
					height: 2,
					width: 2,
				},
				title: "Test",
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					maxCount: 1,
				},
			},
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};
		invalidSave.board.items["item-instance:3"] = {
			id: "item-instance:3",
			itemId: "item:twig",
			x: 0,
			y: 1,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("maxCount is 1");
	});

	it("rejects duplicate occupied board cells", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 0,
			y: 0,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("Duplicate board cell");
	});

	it("rejects overlapping producer queue jobs for the same producer", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.producerJobs["job:first"] = {
			...createProducerJob("job:first"),
			readyAtMs: 1000,
			startAtMs: 0,
		};
		invalidSave.producerJobs["job:overlap"] = {
			...createProducerJob("job:overlap"),
			readyAtMs: 1500,
			startAtMs: 500,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("starts before previous job");
	});

	it("rejects producer line default products that do not belong to the producer", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.producerLines["item-instance:1"] = {
			defaultProductId: "product:missing",
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("Default product");
	});

	it("reports save validation issues on the exact save path", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 4,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([
			"save",
			"inventory",
			"slots",
			0,
			"quantity",
		]);
	});

	it("rejects inventory stacks above the item max stack size", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 4,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("maxStackSize");
	});

	it("rejects board items forbidden by item storage policy", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					storage: "inventory",
				},
			},
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("forbids board location");
	});

	it("rejects inventory items forbidden by item storage policy", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					storage: "board",
				},
			},
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("forbids inventory location");
	});

	it("accepts an inventory instance carrying preserved craft input state", () => {
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const inventorySave = cloneSave(save);
		delete inventorySave.board.items["item-instance:1"];
		inventorySave.inventory.slots[0] = {
			id: "item-instance:1",
			itemId: "item:craft-table",
			kind: "instance",
		};
		inventorySave.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 1,
			},
		};

		expect(() =>
			GameSaveConfigSchema.parse({
				config,
				save: inventorySave,
			}),
		).not.toThrow();
	});

	it("rejects inventory instance ids that collide with board items", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.inventory.slots[0] = {
			id: "item-instance:1",
			itemId: "item:twig",
			kind: "instance",
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("already exists on board");
	});

	it("rejects duplicate inventory instance ids", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.inventory.slots[0] = {
			id: "item-instance:2",
			itemId: "item:twig",
			kind: "instance",
		};
		invalidSave.inventory.slots[1] = {
			id: "item-instance:2",
			itemId: "item:twig",
			kind: "instance",
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("Duplicate inventory instance id");
	});

	it("rejects multiple craft jobs for the same target item", () => {
		const config = createEngineCraftTableTestConfig({
			boardItemCount: 2,
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.craftJobs["job:1"] = createCraftJob("job:1", "item-instance:1");
		invalidSave.craftJobs["job:2"] = createCraftJob("job:2", "item-instance:1");

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("already has running job");
	});

	it("accepts parallel craft jobs on different target items", () => {
		const config = createEngineCraftTableTestConfig({
			boardItemCount: 2,
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const parallelSave = cloneSave(save);
		parallelSave.craftJobs["job:1"] = createCraftJob("job:1", "item-instance:1");
		parallelSave.craftJobs["job:2"] = createCraftJob("job:2", "item-instance:2");

		expect(() =>
			GameSaveConfigSchema.parse({
				config,
				save: parallelSave,
			}),
		).not.toThrow();
	});

	it("rejects producer queues above their effective max queue size", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.producerJobs["job:1"] = createProducerJob("job:1");
		invalidSave.producerJobs["job:2"] = createProducerJob("job:2");

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("maxQueueSize");
	});

	it("rejects stored requirements above their target capacity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:key-storage": {
					capacity: 1,
					itemId: "item:key",
					quantity: 1,
					type: "stored",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					requirementIds: [
						"requirement:key-storage",
					],
				},
			},
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.storedRequirements["item-instance:1"] = {
			items: {
				"item:key": 2,
			},
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("capacity");
	});

	it("rejects craft inputs above their recipe quantity", () => {
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 3,
			},
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("recipe input quantity");
	});

	it("rejects editable craft inputs on a running craft target", () => {
		const config = createEngineCraftTableTestConfig({
			noRecipeInputs: false,
		});
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 1,
			},
		};
		invalidSave.craftJobs["job:1"] = createCraftJob("job:1", "item-instance:1");

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("must not have editable input state");
	});
	it("rejects item spawn job ids that do not match their record key", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.itemSpawnJobs["item-spawn-job:record"] = {
			readyAtMs: 100,
			id: "item-spawn-job:different",
			itemId: "item:twig",
			quantity: 1,
			reason: "debug",
			type: "item.spawn",
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain("job id must match record key");
	});

	it("rejects item spawn jobs for missing items", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.itemSpawnJobs["item-spawn-job:missing"] = {
			readyAtMs: 100,
			id: "item-spawn-job:missing",
			itemId: "item:missing",
			quantity: 1,
			reason: "debug",
			type: "item.spawn",
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain('Missing item "item:missing"');
	});

	it("rejects item spawn dependency cycles", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.itemSpawnJobs["item-spawn-job:a"] = {
			afterJobIds: [
				"item-spawn-job:b",
			],
			readyAtMs: 100,
			id: "item-spawn-job:a",
			itemId: "item:twig",
			quantity: 1,
			reason: "debug",
			type: "item.spawn",
		};
		invalidSave.itemSpawnJobs["item-spawn-job:b"] = {
			afterJobIds: [
				"item-spawn-job:a",
			],
			readyAtMs: 100,
			id: "item-spawn-job:b",
			itemId: "item:plank",
			quantity: 1,
			reason: "debug",
			type: "item.spawn",
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.message).join("\n")).toContain(
			"dependency cycle",
		);
	});

	it("rejects item spawn jobs with missing dependencies", () => {
		const config = createEngineTestConfig();
		const save = createInitialSave({
			config,
			nowMs: 0,
		});
		const invalidSave = cloneSave(save);
		invalidSave.itemSpawnJobs["item-spawn-job:dependent"] = {
			afterJobIds: [
				"item-spawn-job:missing",
			],
			readyAtMs: 100,
			id: "item-spawn-job:dependent",
			itemId: "item:twig",
			quantity: 1,
			reason: "debug",
			type: "item.spawn",
		};

		const result = GameSaveConfigSchema.safeParse({
			config,
			save: invalidSave,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toContain(
			"must reference an existing item spawn job",
		);
	});
});
