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
			completesAtMs: 1500,
			outputTableId: "loot:test",
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startedAtMs: 500,
		});
		expect(result.events).toEqual([
			{
				completesAtMs: 1500,
				jobId: job.id,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startedAtMs: 500,
				type: "product.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("starts the first producer product line when productId is omitted", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
		});
		expect(result.events).toMatchObject([
			{
				productId: "product:test",
				type: "product.started",
			},
		]);
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
			inputs: {
				...baseConfig.inputs,
				"input:shred": {
					...baseConfig.inputs["input:shred"],
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

	it("stores duplicate producer input into the default line before later matching lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			inputs: {
				...baseConfig.inputs,
				"input:alt-shred": {
					name: "Alt shred input",
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				},
			},
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
					inputRefId: "input:alt-shred",
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

	it("stores duplicate producer input into the first enabled product line with capacity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			inputs: {
				...baseConfig.inputs,
				"input:alt-shred": {
					name: "Alt shred input",
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				},
			},
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
					inputRefId: "input:alt-shred",
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
			disabledProductIds: [
				"product:shred",
			],
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
		expect(queuedJobs.find((job) => job.startedAtMs === 1500)).toMatchObject({
			completesAtMs: 2500,
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

	it("stores disabled producer product lines in save state", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const disabled = runAction({
			action: {
				enabled: false,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_enabled",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(disabled.save.producerLines).toEqual({
			"item-instance:1": {
				disabledProductIds: [
					"product:test",
				],
			},
		});
		expect(disabled.events).toEqual([
			{
				changedAtMs: 100,
				nextEnabled: false,
				previousEnabled: true,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.enabled_changed",
			},
		]);
	});

	it("blocks starting disabled producer product lines", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const disabled = runAction({
			action: {
				enabled: false,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_enabled",
			},
			config,
			nowMs: 100,
			save,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 200,
			save: disabled.save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "product_line_disabled",
			});
		}
	});

	it("re-enables producer product lines by removing empty line state", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const disabled = runAction({
			action: {
				enabled: false,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_enabled",
			},
			config,
			nowMs: 100,
			save,
		});
		const enabled = runAction({
			action: {
				enabled: true,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_enabled",
			},
			config,
			nowMs: 200,
			save: disabled.save,
		});

		expect(enabled.save.producerLines).toEqual({});
		expect(enabled.events).toEqual([
			{
				changedAtMs: 200,
				nextEnabled: true,
				previousEnabled: false,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.enabled_changed",
			},
		]);
	});
});
