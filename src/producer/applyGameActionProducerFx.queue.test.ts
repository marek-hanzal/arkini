import { describe, expect, it } from "vitest";
import {
	createEngineTestConfig,
	runAction,
	runActionEither,
	runInitialSave,
	runTick,
} from "./applyGameActionProducerFx.testSupport";

describe("applyGameActionFx Producer queue", () => {
	it("queues product jobs for the same producer instead of running them in parallel", () => {
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		const jobs = Object.values(second.save.producerJobs);
		expect(jobs).toHaveLength(2);
		expect(jobs.find((job) => job.startAtMs === 1500)).toMatchObject({
			readyAtMs: 2500,
		});
		expect(second.nextWakeAtMs).toBe(1500);
	});

	it("rejects line start when the producer queue is full", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
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

	it("stores a non-first line as the runtime default", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const defaulted = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(defaulted.save.lines).toEqual({
			"item-instance:1": {
				defaultLineId: "line:shred",
			},
		});
		expect(defaulted.events).toEqual([
			{
				atMs: 100,
				nextLineId: "line:shred",
				previousLineId: undefined,
				itemInstanceId: "item-instance:1",
				type: "line.default_changed",
			},
		]);

		const reset = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(reset.save.lines).toEqual({
			"item-instance:1": {
				defaultLineId: "line:test",
			},
		});
		expect(reset.events).toEqual([
			{
				atMs: 200,
				nextLineId: "line:test",
				previousLineId: "line:shred",
				itemInstanceId: "item-instance:1",
				type: "line.default_changed",
			},
		]);
	});

	it("unsets the runtime default when the selected line is clicked again", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const defaulted = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});
		const unset = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(unset.save.lines).toEqual({});
		expect(unset.events).toEqual([
			{
				atMs: 200,
				nextLineId: undefined,
				previousLineId: "line:test",
				itemInstanceId: "item-instance:1",
				type: "line.default_changed",
			},
		]);
	});

	it("replaces a depleted remove-on-charges producer with source-cell output", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			producerOverrides: {
				"item:producer": {
					charges: 1,
					onChargesDepleted: "remove",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					chargeCost: 1,
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
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
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
		const completed = runTick({
			config,
			nowMs: started.nextWakeAtMs ?? 1000,
			save: started.save,
		});

		expect(completed.save.board.items["item-instance:1"]).toMatchObject({
			id: "item-instance:1",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fromItemId: "item:producer",
					itemInstanceId: "item-instance:1",
					reason: "producer-depleted",
					toItemId: "item:twig",
					type: "item.replaced",
				}),
			]),
		);
		expect(completed.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemInstanceId: "item-instance:1",
					type: "item.removed",
				}),
			]),
		);
	});
});
