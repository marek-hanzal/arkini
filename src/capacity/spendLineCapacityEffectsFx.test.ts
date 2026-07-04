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

const createCapacityTestConfig = (capacity = 2) =>
	createEngineTestConfig({
		items: {
			"item:rock": {
				capacity: {
					max: capacity,
					onDepleted: "remove",
				},
				maxStackSize: 1,
			},
		},
		lineOverrides: {
			"line:test": {
				effects: [
					{
						amount: 1,
						display: "always",
						items: {
							anyOf: [
								{
									ids: [
										"item:rock",
									],
								},
							],
						},
						kind: "nearby.capacity.spend",
						label: "Nearby rock capacity",
						radius: 1,
						selection: "nearest",
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
			inventory: [],
		},
	});

describe("line capacity spend effects", () => {
	it("spends nearby item capacity when a job starts", () => {
		const config = createCapacityTestConfig(2);
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const rock = findBoardItem(save, {
			itemId: "item:rock",
			x: 1,
			y: 0,
		});
		if (!rock) throw new Error("Missing rock fixture.");

		const result = runAction({
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

		expect(result.save.itemCapacities[rock.id]).toEqual({
			remaining: 1,
		});
		expect(result.events).toEqual(
			expect.arrayContaining([
				{
					amount: 1,
					atMs: 100,
					itemId: "item:rock",
					itemInstanceId: rock.id,
					max: 2,
					nextRemaining: 1,
					previousRemaining: 2,
					type: "item.capacity.changed",
				},
			]),
		);
	});

	it("removes depleted capacity sources at job start without pausing the running job", () => {
		const config = createCapacityTestConfig(1);
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const rock = findBoardItem(save, {
			itemId: "item:rock",
			x: 1,
			y: 0,
		});
		if (!rock) throw new Error("Missing rock fixture.");

		const started = runAction({
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
		expect(started.save.board.items[rock.id]).toBeUndefined();
		expect(started.save.itemCapacities[rock.id]).toBeUndefined();
		expect(started.events).toEqual(
			expect.arrayContaining([
				{
					atMs: 100,
					itemId: "item:rock",
					itemInstanceId: rock.id,
					type: "item.capacity.depleted",
				},
				{
					atMs: 100,
					itemId: "item:rock",
					itemInstanceId: rock.id,
					reason: "capacity-depleted",
					type: "item.removed",
				},
			]),
		);

		const completed = runTick({
			config,
			nowMs: 1100,
			save: started.save,
		});
		expect(Object.values(completed.save.producerJobs)).toHaveLength(0);
		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					lineId: "line:test",
					type: "line.completed",
				}),
			]),
		);
	});

	it("rejects starting a capacity-backed line without a charged nearby source", () => {
		const config = createCapacityTestConfig(1);
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const rock = findBoardItem(save, {
			itemId: "item:rock",
			x: 1,
			y: 0,
		});
		if (!rock) throw new Error("Missing rock fixture.");
		delete save.board.items[rock.id];

		const result = runActionEither({
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

		expect(result._tag).toBe("Left");
		if (result._tag === "Right") return;
		expect(result.left).toMatchObject({
			_tag: "GameActionRejected",
			reason: "effect:missing-grant",
		});
	});
});
