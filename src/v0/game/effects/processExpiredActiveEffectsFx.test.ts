import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { processExpiredActiveEffectsFx } from "~/v0/game/effects/processExpiredActiveEffectsFx";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));
const runExpiredEffects = (props: processExpiredActiveEffectsFx.Props) =>
	Effect.runSync(processExpiredActiveEffectsFx(props));

describe("processExpiredActiveEffectsFx", () => {
	it("expires active effects in deterministic time order", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:later"] = {
			id: "effect-instance:later",
			effectId: "effect:test",
			endAtMs: 200,
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};
		save.activeEffects["effect-instance:earlier-b"] = {
			id: "effect-instance:earlier-b",
			effectId: "effect:test",
			endAtMs: 100,
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};
		save.activeEffects["effect-instance:earlier-a"] = {
			id: "effect-instance:earlier-a",
			effectId: "effect:test",
			endAtMs: 100,
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const result = runExpiredEffects({
			nowMs: 500,
			save,
		});

		expect(
			result.events
				.filter((event) => event.type === "effect.expired")
				.map((event) => event.id),
		).toEqual([
			"effect-instance:earlier-a",
			"effect-instance:earlier-b",
			"effect-instance:later",
		]);
		expect(result.save.activeEffects).toEqual({});
	});
});
