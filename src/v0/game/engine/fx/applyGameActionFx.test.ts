import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { applyGameActionFx } from "~/v0/game/engine/fx/applyGameActionFx";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { withRandomService } from "~/v0/random/logic/withRandomService";

const runAction = (props: applyGameActionFx.Props) =>
	Effect.runSync(applyGameActionFx(props).pipe(withRandomService(TestRandomService)));
const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runActionEither = (props: applyGameActionFx.Props) =>
	Effect.runSync(
		Effect.either(applyGameActionFx(props).pipe(withRandomService(TestRandomService))),
	);

const readOnlyRecordValue = <T>(record: Record<string, T>) => {
	const values = Object.values(record);
	expect(values).toHaveLength(1);
	return values[0] as T;
};

const findBoardItem = (
	save: GameSave,
	matcher: {
		itemId: string;
		x: number;
		y: number;
	},
) =>
	Object.values(save.board.items).find(
		(item) => item.itemId === matcher.itemId && item.x === matcher.x && item.y === matcher.y,
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
	it("opens a stash by applying output and depletion atomically", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
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

		expect(result.save.itemSpawnJobs).toEqual({});
		expect(result.save.board.items).not.toHaveProperty("item-instance:2");
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 2,
		});
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
				itemId: "item:twig",
				reason: "stash-output",
				to: {
					kind: "inventory",
					quantity: 2,
				},
				type: "item.created",
			},
			{
				stashItemInstanceId: "item-instance:2",
				type: "stash.depleted",
			},
			{
				itemInstanceId: "item-instance:2",
				reason: "stash-depleted",
				type: "item.removed",
			},
		]);
	});

	it("opens every remaining stash charge in one atomic sequential-placement batch", () => {
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

		expect(result.save.stashes).toEqual({});
		expect(result.save.itemSpawnJobs).toEqual({});
		expect(result.save.board.items).not.toHaveProperty("item-instance:1");
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 3,
		});
		expect(result.events.map((event) => event.type)).toEqual([
			"item.consumed",
			"stash.opened",
			"item.created",
			"item.created",
			"item.created",
			"stash.depleted",
			"item.removed",
		]);
		expect(result.events.filter((event) => event.type === "item.created")).toMatchObject([
			{
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
			},
			{
				to: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
			},
			{
				to: {
					kind: "inventory",
					quantity: 2,
					slotIndex: 0,
				},
			},
		]);
	});

	it("rejects a full stash open when only part of the remaining output fits", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 1,
				},
				title: "Test",
			},
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					charges: 2,
					inputs: [],
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

		const result = runActionEither({
			action: {
				stashItemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "board:full",
			});
		}
		expect(save.stashes).toEqual({});
		expect(save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:stash",
		});
		expect(save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
	});

	it("keeps stash open state untouched when output placement is unavailable", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					inputs: [],
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
						itemId: "item:stash",
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:twig",
						quantity: 3,
					},
					{
						itemId: "item:plank",
						quantity: 2,
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
				stashItemInstanceId: "item-instance:2",
				inputRefs: [],
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "board:full",
			});
		}
		expect(save.stashes).toEqual({});
		expect(save.itemSpawnJobs).toEqual({});
		expect(save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:stash",
		});
	});

	it("replaces a depleted stash atomically when configured", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 2,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			stashes: {
				...baseConfig.stashes,
				"stash:test": {
					...baseConfig.stashes["stash:test"],
					onDepleted: {
						replaceWithItemId: "item:empty-stash",
					},
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

		expect(result.save.itemSpawnJobs).toEqual({});
		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:empty-stash",
			x: 1,
			y: 0,
		});
		expect(result.save.stashes).toEqual({});
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fromItemId: "item:stash",
					itemInstanceId: "item-instance:2",
					reason: "stash-depleted",
					toItemId: "item:empty-stash",
					type: "item.replaced",
				}),
			]),
		);
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

	it("rejects starting another craft job on the same target", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const action = {
			recipeId: "craft:plank",
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

		const earlyStart = runActionEither({
			action: {
				recipeId: "craft:plank",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 150,
			save: firstDeposit.save,
		});
		expect(earlyStart._tag).toBe("Left");
		if (earlyStart._tag === "Left") {
			expect(earlyStart.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "input_unavailable",
			});
		}

		const secondDeposit = runAction({
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
			nowMs: 200,
			save: firstDeposit.save,
		});

		expect(secondDeposit.save.inventory.slots[0]).toBeNull();
		expect(secondDeposit.save.craftInputs["item-instance:1"]?.items).toEqual({
			"item:twig": 2,
		});

		const started = runAction({
			action: {
				recipeId: "craft:plank",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 300,
			save: secondDeposit.save,
		});

		expect(started.save.craftInputs).toEqual({});
		expect(readOnlyRecordValue(started.save.craftJobs)).toMatchObject({
			completesAtMs: 1300,
			recipeId: "craft:plank",
			targetItemInstanceId: "item-instance:1",
			startedAtMs: 300,
		});
		expect(started.events).toEqual([
			{
				completesAtMs: 1300,
				jobId: readOnlyRecordValue(started.save.craftJobs).id,
				recipeId: "craft:plank",
				startedAtMs: 300,
				targetItemInstanceId: "item-instance:1",
				type: "craft.started",
			},
		]);
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
				recipeId: "craft:plank",
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
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
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

	it("merges only source-owned explicit combo rules", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:water": {
					assetId: "asset:test",
					code: "water",
					description: "Water",
					maxStackSize: 3,
					mergeIds: [
						"merge:water-twig",
					],
					name: "Water",
					sort: 8,
					tags: [],
					tier: 0,
				},
			},
			merge: {
				...baseConfig.merge,
				"merge:water-twig": {
					resultItemId: "item:plank",
					withItemId: "item:twig",
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
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
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

	it("places an inventory stack around a seeded board cell", () => {
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
				placementMode: "nearest_by_manhattan",
				quantity: 2,
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

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
				from: {
					nextQuantity: 0,
					previousQuantity: 2,
					quantity: 2,
					slotIndex: 0,
				},
				reason: "inventory-placement",
				type: "item.consumed",
			},
			{
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				to: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 0,
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("places seeded inventory items around an occupied seed cell", () => {
		const config = createEngineTestConfig();
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
				placementMode: "nearest_by_manhattan",
				slotIndex: 0,
				type: "inventory.item.place",
				x: 0,
				y: 0,
			},
			config,
			nowMs: 10,
			save,
		});

		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toBeNull();
	});

	it("stashes a stateful stackable board item as an inventory instance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:craft-stack": {
					assetId: "asset:test",
					code: "craft-stack",
					craftRecipeId: "craft:plank",
					description: "Stackable craft target",
					maxStackSize: 3,
					name: "Craft Stack",
					sort: 8,
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:craft-stack",
						x: 0,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:craft-stack",
						quantity: 2,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftInputs["item-instance:1"] = {
			items: {
				"item:twig": 1,
			},
		};

		const stashed = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			nowMs: 10,
			save,
		});

		expect(stashed.save.board.items["item-instance:1"]).toBeUndefined();
		expect(stashed.save.inventory.slots).toEqual([
			{
				itemId: "item:craft-stack",
				quantity: 2,
			},
			{
				id: "item-instance:1",
				itemId: "item:craft-stack",
				kind: "instance",
			},
		]);
		expect(stashed.save.craftInputs["item-instance:1"]).toEqual({
			items: {
				"item:twig": 1,
			},
		});

		const placed = runAction({
			action: {
				slotIndex: 1,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 20,
			save: stashed.save,
		});

		expect(placed.save.inventory.slots[1]).toBeNull();
		expect(placed.save.board.items["item-instance:1"]).toEqual({
			id: "item-instance:1",
			itemId: "item:craft-stack",
			x: 1,
			y: 0,
		});
		expect(placed.save.craftInputs["item-instance:1"]).toEqual({
			items: {
				"item:twig": 1,
			},
		});
	});

	it("rejects stashing a board item with a running job", () => {
		const config = createEngineCraftTableTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:1"] = {
			completesAtMs: 1000,
			id: "job:1",
			recipeId: "craft:plank",
			startedAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		const result = runActionEither({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.stash",
			},
			config,
			nowMs: 10,
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
