import { describe, expect, it } from "vitest";
import {
	createEngineTestConfig,
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "./applyGameActionProducerFx.testSupport";

describe("applyGameActionFx Producer inputs", () => {
	it("consumes explicit inventory inputs at line start", () => {
		const config = createEngineTestConfig();
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
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "line-input",
				type: "item.consumed",
			},
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("auto-fills missing producer input from the board before starting the product", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 0,
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("starts an up-to line with one explicit input ref", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 4,
							consume: true,
							itemId: "item:twig",
							mode: "upTo",
							quantity: 4,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
			startAtMs: 100,
		});
	});

	it("starts an up-to line with one stored input", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 4,
							consume: true,
							itemId: "item:twig",
							mode: "upTo",
							quantity: 4,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerInputs["item-instance:1"] = {
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
			startAtMs: 100,
		});
	});

	it("auto-fills an up-to line to its run maximum before starting", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 4,
							consume: true,
							itemId: "item:twig",
							mode: "upTo",
							quantity: 4,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		for (const [index, x] of [
			1,
			2,
			3,
			4,
		].entries()) {
			save.board.items[`item-instance:${index + 2}`] = {
				id: `item-instance:${index + 2}`,
				itemId: "item:twig",
				x,
				y: 0,
			};
		}

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(
			Object.values(result.save.board.items).filter((item) => item.itemId === "item:twig"),
		).toHaveLength(0);
		expect(
			result.events.filter((event) => event.type === "producer_input.stored"),
		).toHaveLength(4);
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
			startAtMs: 100,
		});
	});

	it("leaves an incomplete line idle when auto-fill finds no inputs", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toEqual([]);
	});

	it("auto-fills available producer inputs without starting an incomplete product", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:twig",
							quantity: 2,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({
			"item-instance:1": {
				lineInputs: {
					"line:shred": {
						items: {
							"item:twig": 1,
						},
					},
				},
			},
		});
		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 0,
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
		]);
	});

	it("auto-fills only missing producer input when the line is partially filled", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:twig",
							quantity: 2,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};
		save.producerInputs["item-instance:1"] = {
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 2,
				previousQuantity: 1,
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("auto-fills missing producer input from inventory before starting the product", () => {
		const config = createEngineTestConfig();
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
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("stores line input from inventory and later consumes it on line start", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const stored = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(stored.save.inventory.slots[0]).toBeNull();
		expect(stored.save.producerInputs).toEqual({
			"item-instance:1": {
				lineInputs: {
					"line:shred": {
						items: {
							"item:twig": 1,
						},
					},
				},
			},
		});
		expect(stored.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "producer-input-store",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
		]);

		const started = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 200,
			save: stored.save,
		});

		expect(started.save.producerInputs).toEqual({});
		expect(started.events).toMatchObject([
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("withdraws an entire line input through board then inventory placement", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 3,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerInputs["item-instance:1"] = {
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 2,
					},
				},
			},
		};

		const result = runAction({
			action: {
				itemId: "item:twig",
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toMatchObject({
			quantity: 2,
		});
		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				previousQuantity: 2,
				lineId: "line:shred",
				quantity: 2,
				type: "producer_input.withdrawn",
			},
			{
				itemId: "item:twig",
				reason: "producer-input-withdraw",
				to: {
					kind: "board",
					quantity: 2,
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("keeps line input stored when withdraw placement is unavailable", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:rock",
			x: 1,
			y: 0,
		};
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.inventory.slots[1] = {
			itemId: "item:plank",
			quantity: 2,
		};
		save.producerInputs["item-instance:1"] = {
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(save.producerInputs["item-instance:1"]?.lineInputs["line:shred"]?.items).toEqual({
			"item:twig": 1,
		});
	});

	it("stores duplicate producer input into the saved default line before earlier lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.lines["item-instance:1"] = {
			defaultLineId: "line:alt-shred",
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the default line before later matching lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the first line with remaining capacity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerInputs["item-instance:1"] = {
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"line:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the next line after the default line is full", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerInputs["item-instance:1"] = {
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"line:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});
});
