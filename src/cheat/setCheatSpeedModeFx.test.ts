import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { cheatSpeedDisableItemId, cheatSpeedEnableItemId } from "~/cheat/GameCheatSpeedItem";
import {
	readOnlyRecordValue,
	runAction,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";

const createLongTimingConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		producerOverrides: {
			"item:producer": {
				maxQueueSize: 2,
			},
		},
		lineOverrides: {
			"line:test": {
				...baseConfig.lineCatalog["line:test"],
				durationMs: 30000,
			},
		},
		craftOverrides: {
			...baseConfig.craftCatalog,
			"item:craft-table": {
				...baseConfig.craftCatalog["item:craft-table"],
				durationMs: 30000,
			},
		},
	});
};

describe("setCheatSpeedModeFx", () => {
	it("normalizes every speed watch item to the selected mode item", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 2,
				},
			},
			items: {
				...baseConfig.items,
				[cheatSpeedDisableItemId]: {
					assetIds: [
						"asset:test",
					],
					description: "Closed speed watch",
					maxStackSize: 3,
					name: "Closed Speed Watch",
					storage: "both",
					tags: [],
					tier: 0,
				},
				[cheatSpeedEnableItemId]: {
					assetIds: [
						"asset:test",
					],
					description: "Open speed watch",
					maxStackSize: 3,
					name: "Open Speed Watch",
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			startingState: {
				board: [
					{
						itemId: cheatSpeedDisableItemId,
						x: 0,
						y: 0,
					},
					{
						itemId: cheatSpeedEnableItemId,
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: cheatSpeedDisableItemId,
						quantity: 2,
					},
					{
						itemId: cheatSpeedEnableItemId,
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const enabled = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 0,
			save,
		}).save;

		expect(Object.values(enabled.board.items).map((item) => item.itemId)).toEqual([
			cheatSpeedEnableItemId,
			cheatSpeedEnableItemId,
		]);
		expect(
			enabled.inventory.slots.flatMap((slot) =>
				slot
					? [
							slot.itemId,
						]
					: [],
			),
		).toEqual([
			cheatSpeedEnableItemId,
			cheatSpeedEnableItemId,
		]);

		const disabled = runAction({
			action: {
				mode: "normal",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 1000,
			save: enabled,
		}).save;

		expect(Object.values(disabled.board.items).map((item) => item.itemId)).toEqual([
			cheatSpeedDisableItemId,
			cheatSpeedDisableItemId,
		]);
		expect(
			disabled.inventory.slots.flatMap((slot) =>
				slot
					? [
							slot.itemId,
						]
					: [],
			),
		).toEqual([
			cheatSpeedDisableItemId,
			cheatSpeedDisableItemId,
		]);
	});
	it("emits a speed mode change event only when the mode changes", () => {
		const config = createLongTimingConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const enabled = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(enabled.events).toEqual([
			{
				atMs: 100,
				nextMode: "instant",
				previousMode: "normal",
				type: "cheat.speed_mode.changed",
			},
		]);

		const repeated = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 200,
			save: enabled.save,
		});

		expect(repeated.events).toEqual([]);
	});

	it("makes newly started producer jobs finish after one second", () => {
		const config = createLongTimingConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const producer = readOnlyRecordValue(save.board.items);

		const enabled = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 0,
			save,
		}).save;

		const started = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: producer.id,
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 0,
			save: enabled,
		}).save;
		const job = readOnlyRecordValue(started.producerJobs);

		expect(started.cheats?.speedMode).toBe("instant");
		expect(job.readyAtMs - job.startAtMs).toBe(1000);
	});

	it("pulls queued producer jobs into the instant timing window", () => {
		const config = createLongTimingConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const producer = readOnlyRecordValue(save.board.items);
		const firstQueued = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: producer.id,
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		}).save;
		const secondQueued = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: producer.id,
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 0,
			save: firstQueued,
		}).save;

		const enabled = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 0,
			save: secondQueued,
		}).save;
		const jobs = Object.values(enabled.producerJobs).sort(
			(left, right) => left.readyAtMs - right.readyAtMs,
		);

		expect(jobs).toHaveLength(2);
		expect(jobs.map((job) => job.startAtMs)).toEqual([
			0,
			1000,
		]);
		expect(jobs.map((job) => job.readyAtMs)).toEqual([
			1000,
			2000,
		]);
	});

	it("uses normal timings again after the disable item switches the mode back", () => {
		const config = createLongTimingConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const producer = readOnlyRecordValue(save.board.items);
		const enabled = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 0,
			save,
		}).save;
		const disabled = runAction({
			action: {
				mode: "normal",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 0,
			save: enabled,
		}).save;

		const started = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: producer.id,
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 0,
			save: disabled,
		}).save;
		const job = readOnlyRecordValue(started.producerJobs);

		expect(started.cheats?.speedMode).toBe("normal");
		expect(job.readyAtMs - job.startAtMs).toBe(30000);
	});

	it("also applies one-second timing to craft jobs", () => {
		const config = createLongTimingConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const craftTarget = readOnlyRecordValue(save.board.items);
		const craftSave = {
			...save,
			board: {
				items: {
					[craftTarget.id]: {
						...craftTarget,
						itemId: "item:craft-table",
					},
				},
			},
			inventory: {
				slots: [
					{
						itemId: "item:twig",
						quantity: 2,
					},
					null,
				],
			},
		};
		const enabled = runAction({
			action: {
				mode: "instant",
				type: "cheat.speed_mode.set",
			},
			config,
			nowMs: 0,
			save: craftSave,
		}).save;
		const started = runAction({
			action: {
				recipeId: "item:craft-table",
				targetItemInstanceId: craftTarget.id,
				type: "craft.start",
			},
			config,
			nowMs: 0,
			save: enabled,
		}).save;
		const job = readOnlyRecordValue(started.craftJobs);

		expect(job.readyAtMs - job.startAtMs).toBe(1000);
	});
});
