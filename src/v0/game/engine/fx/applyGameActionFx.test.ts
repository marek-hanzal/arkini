import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { applyGameActionFx } from "~/v0/game/engine/fx/applyGameActionFx";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";

const runAction = (props: applyGameActionFx.Props) =>
	Effect.runSync(applyGameActionFx(props).pipe(withRandomService(TestRandomService)));
const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runActionEither = (props: applyGameActionFx.Props) =>
	Effect.runSync(
		Effect.either(applyGameActionFx(props).pipe(withRandomService(TestRandomService))),
	);

describe("applyGameActionFx", () => {
	it("starts a no-input producer product as an Effect action", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.save.producerJobs["job:1"]).toMatchObject({
			completesAtMs: 1500,
			id: "job:1",
			outputTableId: "loot:test",
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startedAtMs: 500,
		});
		expect(result.events).toEqual([
			{
				completesAtMs: 1500,
				jobId: "job:1",
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startedAtMs: 500,
				type: "product.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
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

	it("accepts passive requirements from inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirements: [
						{
							itemId: "item:twig",
							quantity: 1,
							scope: "board_or_inventory",
							type: "passive",
						},
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
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
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirements: [
						{
							itemId: "item:twig",
							quantity: 1,
							scope: "inventory",
							type: "passive",
						},
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
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
	it("opens a stash by consuming input and scheduling output plus depletion", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:stash",
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:key",
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
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				stashItemInstanceId: "item-instance:2",
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.events).toMatchObject([
			{
				itemId: "item:key",
				reason: "stash-input",
				type: "item.consumed",
			},
			{
				remainingCharges: 0,
				stashItemInstanceId: "item-instance:2",
				type: "stash.opened",
			},
			{
				stashItemInstanceId: "item-instance:2",
				type: "stash.depleted",
			},
		]);
		expect(Object.values(result.save.scheduledEvents)).toEqual([
			expect.objectContaining({
				itemId: "item:twig",
				reason: "stash-output",
				type: "item.spawn",
			}),
			expect.objectContaining({
				itemId: "item:twig",
				reason: "stash-output",
				type: "item.spawn",
			}),
			expect.objectContaining({
				afterEventIds: [
					"scheduled-event:1",
					"scheduled-event:2",
				],
				itemInstanceId: "item-instance:2",
				type: "board.item.remove",
			}),
		]);
	});

	it("keeps multi-charge stash state without scheduling depletion", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					charges: 2,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:key",
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
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				stashItemInstanceId: "item-instance:1",
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.stashes["item-instance:1"]).toEqual({
			remainingCharges: 1,
		});
		expect(result.events.map((event) => event.type)).toEqual([
			"item.consumed",
			"stash.opened",
		]);
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		expect(second.save.producerJobs["job:2"]).toMatchObject({
			completesAtMs: 2500,
			startedAtMs: 1500,
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runActionEither({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
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

	it("starts craft jobs by consuming inputs and reserving stored requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-table": {
					assetId: "asset:test",
					code: "craft-table",
					craftRecipeId: "craft:plank",
					description: "Craft table",
					maxStackSize: 1,
					name: "Craft Table",
					sort: 8,
					tags: [],
					tier: 0,
				},
			},
			craftRecipes: {
				...baseConfig.craftRecipes,
				"craft:plank": {
					...baseConfig.craftRecipes["craft:plank"],
					requirements: [
						{
							capacity: 1,
							itemId: "item:axe",
							quantity: 1,
							type: "stored",
						},
					],
				},
			},
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
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
				inventory: [
					{
						itemId: "item:twig",
						quantity: 2,
					},
					{
						itemId: "item:axe",
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
				inputRefs: [
					{
						kind: "inventory",
						quantity: 2,
						slotIndex: 0,
					},
				],
				recipeId: "craft:plank",
				targetItemInstanceId: "item-instance:1",
				requirementRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 1,
					},
				],
				type: "craft.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots).toEqual([
			null,
			null,
		]);
		expect(result.save.craftJobs["job:1"]).toMatchObject({
			completesAtMs: 1100,
			recipeId: "craft:plank",
			targetItemInstanceId: "item-instance:1",
			returnItems: [
				{
					itemId: "item:axe",
					quantity: 1,
				},
			],
			startedAtMs: 100,
		});
		expect(result.events.map((event) => event.type)).toEqual([
			"item.consumed",
			"item.consumed",
			"craft.started",
		]);
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "craft-input",
			},
			{
				itemId: "item:axe",
				reason: "craft-requirement",
			},
			{
				completesAtMs: 1100,
				targetItemInstanceId: "item-instance:1",
				type: "craft.started",
			},
		]);
	});

	it("stores producer requirements on the producer item before product start", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirements: [
						{
							capacity: 1,
							itemId: "item:axe",
							quantity: 1,
							type: "stored",
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
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const stocked = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.store",
			},
			config,
			nowMs: 100,
			save,
		});
		const started = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 200,
			save: stocked.save,
		});

		expect(stocked.save.inventory.slots[0]).toBeNull();
		expect(stocked.save.storedRequirements["item-instance:1"]).toEqual({
			items: {
				"item:axe": 1,
			},
		});
		expect(stocked.events).toMatchObject([
			{
				itemId: "item:axe",
				reason: "stored-requirement-store",
				type: "item.consumed",
			},
			{
				itemId: "item:axe",
				nextQuantity: 1,
				previousQuantity: 0,
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.stored",
			},
		]);
		expect(started.events).toMatchObject([
			{
				productId: "product:test",
				type: "product.started",
			},
		]);
	});

	it("rejects producer products while stored requirements are missing", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirements: [
						{
							capacity: 1,
							itemId: "item:axe",
							quantity: 1,
							type: "stored",
						},
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
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

	it("withdraws stored requirements back into inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirements: [
						{
							capacity: 1,
							itemId: "item:axe",
							quantity: 1,
							type: "stored",
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
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const stocked = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.store",
			},
			config,
			nowMs: 100,
			save,
		});

		const withdrawn = runAction({
			action: {
				itemId: "item:axe",
				quantity: 1,
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.withdraw",
			},
			config,
			nowMs: 200,
			save: stocked.save,
		});

		expect(withdrawn.save.storedRequirements).toEqual({});
		expect(withdrawn.save.inventory.slots[0]).toEqual({
			itemId: "item:axe",
			quantity: 1,
		});
		expect(withdrawn.events).toMatchObject([
			{
				itemId: "item:axe",
				nextQuantity: 0,
				previousQuantity: 1,
				type: "stored_requirement.withdrawn",
			},
			{
				itemId: "item:axe",
				reason: "stored-requirement-withdraw",
				type: "item.created",
			},
		]);
	});

	it("uses stash stored requirements from the stash item save state", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
				},
			},
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					requirements: [
						{
							capacity: 1,
							itemId: "item:axe",
							quantity: 1,
							type: "stored",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:key",
						quantity: 1,
					},
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const stocked = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 1,
				},
				targetItemInstanceId: "item-instance:1",
				type: "stored_requirement.store",
			},
			config,
			nowMs: 100,
			save,
		});
		const opened = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				stashItemInstanceId: "item-instance:1",
				type: "stash.open",
			},
			config,
			nowMs: 200,
			save: stocked.save,
		});

		expect(stocked.save.storedRequirements["item-instance:1"]).toEqual({
			items: {
				"item:axe": 1,
			},
		});
		expect(opened.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					stashItemInstanceId: "item-instance:1",
					type: "stash.opened",
				}),
			]),
		);
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
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
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

	it("removes a tile with a kept tool", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:rock",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:axe",
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
				targetItemInstanceId: "item-instance:1",
				toolRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "tile.remove",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items).toEqual({});
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:axe",
			quantity: 1,
		});
		expect(result.events).toEqual([
			{
				itemId: "item:rock",
				itemInstanceId: "item-instance:1",
				reason: "tile-remove",
				removedAtMs: 100,
				type: "item.removed",
			},
		]);
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
});

describe("applyGameActionFx runtime placement actions", () => {
	it("moves a board item inside the runtime save", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			x: 1,
			y: 0,
		});
	});

	it("places one inventory item on a board cell", () => {
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
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:twig",
			x: 1,
			y: 0,
		});
		expect(result.events).toMatchObject([
			{
				reason: "inventory-placement",
				type: "item.consumed",
			},
			{
				reason: "inventory-placement",
				type: "item.created",
			},
		]);
	});

	it("stashes a board item into inventory", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toBeUndefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:producer",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				reason: "board-stash",
				type: "item.consumed",
			},
			{
				reason: "board-stash",
				type: "item.created",
			},
		]);
	});
});
