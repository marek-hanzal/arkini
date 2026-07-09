import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/engine/runGameTickFx";
import { TestRandomService } from "~/engine/test/TestRandomService";
import { withRandomService } from "~/random/withRandomService";
import {
	findBoardItem,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

describe("applyGameActionFx Stash", () => {
	it("opens a stash through its line and removes it when charges are depleted", () => {
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

		const result = started;

		expect(result.nextWakeAtMs).toBeNull();
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
		).toMatchObject({
			quantity: 2,
		});
		expect(result.save.inventory.slots[0]).toBeNull();
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:key",
					reason: "line-input",
					type: "item.consumed",
				}),
				expect.objectContaining({
					itemInstanceId: "item-instance:2",
					lineId: "line:stash",
					type: "line.started",
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
					itemInstanceId: "item-instance:2",
					lineId: "line:stash",
					type: "line.completed",
				}),
				expect.objectContaining({
					fromItemId: "item:stash",
					itemInstanceId: "item-instance:2",
					reason: "producer-depleted",
					toItemId: "item:twig",
					type: "item.replaced",
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
					itemInstanceId: "item-instance:1",
					lineId: "line:stash",
					type: "producer_input.stored",
				}),
				expect.objectContaining({
					itemInstanceId: "item-instance:1",
					lineId: "line:stash",
					type: "line.started",
				}),
			]),
		);
	});

	it("keeps partially auto-filled stash inputs in producer input state", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:stash": {
					...baseConfig.lineCatalog["line:stash"],
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
			lineInputs: {
				"line:stash": {
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
				itemInstanceId: "item-instance:1",
				lineId: "line:stash",
				type: "producer_input.stored",
			}),
		]);
	});

	it("reserves producer charges while queued jobs are pending", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					charges: 1,
					maxQueueSize: 2,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 0,
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
