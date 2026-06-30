import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import {
	readOnlyRecordValue,
	runAction,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

const createLongTimingConfig = () => {
	const baseConfig = createEngineTestConfig();
	return createEngineTestConfig({
		producers: {
			...baseConfig.producers,
			"item:producer": {
				...baseConfig.producers["item:producer"],
				maxQueueSize: 2,
			},
		},
		products: {
			...baseConfig.products,
			"product:test": {
				...baseConfig.products["product:test"],
				durationMs: 30000,
			},
		},
		craftRecipes: {
			...baseConfig.craftRecipes,
			"item:craft-table": {
				...baseConfig.craftRecipes["item:craft-table"],
				durationMs: 30000,
			},
		},
	});
};

describe("setCheatSpeedModeFx", () => {
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
				producerItemInstanceId: producer.id,
				productId: "product:test",
				type: "producer.product.start",
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
				producerItemInstanceId: producer.id,
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		}).save;
		const secondQueued = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: producer.id,
				productId: "product:test",
				type: "producer.product.start",
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
				producerItemInstanceId: producer.id,
				productId: "product:test",
				type: "producer.product.start",
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
