import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";
import {
	findBoardItem,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

describe("applyGameActionFx Stash", () => {
	it("opens a stash through its producer product line and removes it when charges are depleted", () => {
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

		const started = runAction({
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

		const result = runTick({
			config,
			nowMs: started.nextWakeAtMs ?? 101,
			save: started.save,
		});

		expect(result.save.board.items["item-instance:2"]).toMatchObject({
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		});
		expect(result.save.producerCharges).toEqual({});
		expect(result.save.producerJobs).toEqual({});
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
		expect(started.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:key",
					reason: "product-input",
					type: "item.consumed",
				}),
				expect.objectContaining({
					producerItemInstanceId: "item-instance:2",
					productId: "product:stash",
					type: "product.started",
				}),
			]),
		);
		expect(result.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemInstanceId: "item-instance:2",
					type: "item.removed",
				}),
			]),
		);
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					producerItemInstanceId: "item-instance:2",
					productId: "product:stash",
					type: "product.completed",
				}),
				expect.objectContaining({
					fromItemId: "item:stash",
					itemInstanceId: "item-instance:2",
					reason: "producer-depleted",
					toItemId: "item:twig",
					type: "item.replaced",
				}),
				expect.objectContaining({
					itemId: "item:twig",
					reason: "product-output",
					type: "item.created",
				}),
			]),
		);
	});

	it("auto-fills stash inputs through producer input storage", () => {
		const config = createEngineTestConfig({
			startingState: {
				board: [
					{
						itemId: "item:stash",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:producer",
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

		const started = runAction({
			action: {
				inputRefs: [],
				stashItemInstanceId: "item-instance:1",
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});
		const result = runTick({
			config,
			nowMs: started.nextWakeAtMs ?? 101,
			save: started.save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			id: "item-instance:1",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		expect(started.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:key",
					reason: "producer-input-auto-fill",
					type: "item.consumed",
				}),
				expect.objectContaining({
					itemId: "item:key",
					producerItemInstanceId: "item-instance:1",
					productId: "product:stash",
					type: "producer_input.stored",
				}),
				expect.objectContaining({
					producerItemInstanceId: "item-instance:1",
					productId: "product:stash",
					type: "product.started",
				}),
			]),
		);
	});

	it("keeps partially auto-filled stash inputs in producer input state", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:stash": {
					...baseConfig.products["product:stash"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:key",
							quantity: 2,
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
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				stashItemInstanceId: "item-instance:1",
				type: "stash.open",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:1"]).toMatchObject({
			itemId: "item:stash",
		});
		expect(result.save.producerJobs).toEqual({});
		expect(result.save.producerCharges).toEqual({});
		expect(result.save.producerInputs["item-instance:1"]).toEqual({
			productInputs: {
				"product:stash": {
					items: {
						"item:key": 1,
					},
				},
			},
		});
		expect(result.events).toEqual([
			expect.objectContaining({
				itemId: "item:key",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			}),
			expect.objectContaining({
				itemId: "item:key",
				producerItemInstanceId: "item-instance:1",
				productId: "product:stash",
				type: "producer_input.stored",
			}),
		]);
	});

	it("reserves producer charges while queued jobs are pending", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					charges: 1,
					maxQueueSize: 2,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					chargeCost: 1,
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
			nowMs: 0,
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
			nowMs: 1,
			save: first.save,
		});

		expect(second._tag).toBe("Left");
		expect(second._tag === "Left" ? second.left : undefined).toMatchObject({
			_tag: "GameActionRejected",
			reason: "producer_charges_depleted",
		});
	});
});
