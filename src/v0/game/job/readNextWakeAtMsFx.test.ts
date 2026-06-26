import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { pastDueGameJobWakeDelayMs, readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runNextWakeAtMs = (props: readNextWakeAtMsFx.Props) =>
	Effect.runSync(readNextWakeAtMsFx(props));

describe("readNextWakeAtMsFx", () => {
	it("wakes again when a producer job is already due in a loaded save", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerJobs["job:ready"] = {
			id: "job:ready",
			placement: "board_then_inventory",
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			readyAtMs: 100,
			startAtMs: 0,
		};

		expect(
			runNextWakeAtMs({
				nowMs: 500,
				save,
			}),
		).toBe(500 + pastDueGameJobWakeDelayMs);
	});

	it("wakes again when a craft job is already due in a loaded save", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.craftJobs["job:craft-ready"] = {
			id: "job:craft-ready",
			recipeId: "item:craft-table",
			readyAtMs: 100,
			startAtMs: 0,
			targetItemInstanceId: "item-instance:1",
		};

		expect(
			runNextWakeAtMs({
				nowMs: 500,
				save,
			}),
		).toBe(500 + pastDueGameJobWakeDelayMs);
	});

	it("wakes again when an active effect is already expired in a loaded save", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:expired"] = {
			id: "effect-instance:expired",
			effectId: "effect:test",
			endAtMs: 100,
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		expect(
			runNextWakeAtMs({
				nowMs: 500,
				save,
			}),
		).toBe(500 + pastDueGameJobWakeDelayMs);
	});

	it("does not keep waking on an active effect start time that is already in the past", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:running"] = {
			id: "effect-instance:running",
			effectId: "effect:test",
			endAtMs: 1000,
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 100,
		};

		expect(
			runNextWakeAtMs({
				nowMs: 500,
				save,
			}),
		).toBe(1000);
	});
});
