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

describe("applyGameActionFx Producer", () => {
	it("starts a no-input producer product as an Effect action", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startAtMs: 500,
		});
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startAtMs: 500,
				type: "product.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("starts active effect product lines as timed producer jobs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test": {
					name: "Test effect",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productIds: [
									"product:shred",
								],
							},
						},
					],
					scope: "global",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					activatesEffectId: "effect:test",
					output: undefined,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const activeEffect = readOnlyRecordValue(result.save.activeEffects);
		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startAtMs: 500,
		});
		expect(activeEffect).toMatchObject({
			startAtMs: 500,
			effectId: "effect:test",
			endAtMs: 1500,
			sourceItemInstanceId: "item-instance:1",
		});
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startAtMs: 500,
				type: "product.started",
			},
			{
				atMs: 500,
				startAtMs: 500,
				effectId: "effect:test",
				endAtMs: 1500,
				id: activeEffect.id,
				sourceItemInstanceId: "item-instance:1",
				type: "effect.activated",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("rejects default producer product action when no default line is selected", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("rejects hidden producer product lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					visibility: "hidden",
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
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("starts the saved default producer product line when productId is omitted", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:shred",
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save: {
				...save,
				board: {
					items: {
						...save.board.items,
						"item-instance:2": {
							id: "item-instance:2",
							itemId: "item:twig",
							x: 1,
							y: 0,
						},
					},
				},
			},
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				productId: "product:shred",
				type: "product.started",
			}),
		);
	});

	it("accepts producer proximity requirements from diagonal neighbors", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 2,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirementIds: [
						"requirement:near-twig",
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
						itemId: "item:twig",
						x: 1,
						y: 1,
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
	});

	it("slows product duration by nearest satisfied producer proximity distance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 2,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirementIds: [
						"requirement:near-twig",
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
						itemId: "item:twig",
						x: 2,
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 2500,
			startAtMs: 500,
		});
		expect(result.nextWakeAtMs).toBe(2500);
	});

	it("averages producer and product proximity duration multipliers", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 2,
					durationFactor: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
				"requirement:near-rock": {
					distance: 1,
					durationFactor: 1,
					itemIds: [
						"item:rock",
					],
					type: "proximity",
				},
			},
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirementIds: [
						"requirement:near-twig",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-rock",
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
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 0,
						y: 1,
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			startAtMs: 0,
		});
	});

	it("stacks product duration penalties from every active proximity hindrance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					hinderedBy: [
						{
							distance: 2,
							durationFactor: 0.5,
							itemIds: [
								"item:twig",
							],
							type: "proximity",
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
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 0,
		});
	});

	it("stacks active passive hindrance duration penalties", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					hinderedBy: [
						{
							durationFactor: 1,
							itemId: "item:rock",
							quantity: 1,
							scope: "board_or_inventory",
							type: "passive",
						},
						{
							durationFactor: 0.5,
							itemId: "item:twig",
							quantity: 1,
							scope: "inventory",
							type: "passive",
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
						itemId: "item:rock",
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

		const result = runAction({
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

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 0,
		});
	});

	it("rejects missing product proximity requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 2,
				},
			},
			requirements: {
				...baseConfig.requirements,
				"requirement:near-twig": {
					distance: 1,
					itemIds: [
						"item:twig",
					],
					type: "proximity",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:near-twig",
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

	it("consumes explicit inventory inputs at product start", () => {
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
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
				reason: "product-input",
				type: "item.consumed",
			},
			{
				productId: "product:shred",
				type: "product.started",
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("leaves an incomplete producer product idle when auto-fill finds no inputs", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
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
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({
			"item-instance:1": {
				productInputs: {
					"product:shred": {
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
		]);
	});

	it("auto-fills only missing producer input when the product line is partially filled", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
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
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("stores producer line input from inventory and later consumes it on product start", () => {
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
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(stored.save.inventory.slots[0]).toBeNull();
		expect(stored.save.producerInputs).toEqual({
			"item-instance:1": {
				productInputs: {
					"product:shred": {
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
				productId: "product:shred",
				type: "producer_input.stored",
			},
		]);

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 200,
			save: stored.save,
		});

		expect(started.save.producerInputs).toEqual({});
		expect(started.events).toMatchObject([
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("withdraws an entire producer product-line input through board then inventory placement", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
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
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 2,
					},
				},
			},
		};

		const result = runAction({
			action: {
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
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
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				previousQuantity: 2,
				productId: "product:shred",
				quantity: 2,
				type: "producer_input.withdrawn",
			},
			{
				itemId: "item:twig",
				reason: "producer-input-withdraw",
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				itemId: "item:twig",
				reason: "producer-input-withdraw",
				to: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("keeps producer line input stored when withdraw placement is unavailable", () => {
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
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(
			save.producerInputs["item-instance:1"]?.productInputs["product:shred"]?.items,
		).toEqual({
			"item:twig": 1,
		});
	});

	it("stores duplicate producer input into the saved default line before earlier lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
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
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:alt-shred",
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the default line before later matching lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
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
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the first product line with remaining capacity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
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
			productInputs: {
				"product:shred": {
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
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the next product line after the default line is full", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
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
			productInputs: {
				"product:shred": {
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
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("accepts passive requirements from inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:twig-passive": {
					itemId: "item:twig",
					quantity: 1,
					scope: "board_or_inventory",
					type: "passive",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:twig-passive",
					],
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
	});

	it("fails through the typed error channel when a passive requirement is missing", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			requirements: {
				...baseConfig.requirements,
				"requirement:twig-passive": {
					itemId: "item:twig",
					quantity: 1,
					scope: "inventory",
					type: "passive",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirementIds: [
						"requirement:twig-passive",
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

	it("queues product jobs for the same producer instead of running them in parallel", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		const queuedJobs = Object.values(second.save.producerJobs);
		expect(queuedJobs).toHaveLength(2);
		expect(queuedJobs.find((job) => job.startAtMs === 1500)).toMatchObject({
			readyAtMs: 2500,
		});
		expect(second.nextWakeAtMs).toBe(1500);
	});

	it("rejects producer product start when the producer queue is full", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		expect(second._tag).toBe("Left");
		if (second._tag === "Left") {
			expect(second.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "producer_queue_full",
			});
		}
	});

	it("stores a non-first producer product line as the runtime default", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const defaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(defaulted.save.producerLines).toEqual({
			"item-instance:1": {
				defaultProductId: "product:shred",
			},
		});
		expect(defaulted.events).toEqual([
			{
				atMs: 100,
				nextProductId: "product:shred",
				previousProductId: undefined,
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);

		const reset = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(reset.save.producerLines).toEqual({
			"item-instance:1": {
				defaultProductId: "product:test",
			},
		});
		expect(reset.events).toEqual([
			{
				atMs: 200,
				nextProductId: "product:test",
				previousProductId: "product:shred",
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);
	});

	it("unsets the runtime default when the selected producer product line is clicked again", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const defaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});
		const unset = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(unset.save.producerLines).toEqual({});
		expect(unset.events).toEqual([
			{
				atMs: 200,
				nextProductId: undefined,
				previousProductId: "product:test",
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);
	});
});
