import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readGameWorldGrantIds } from "~/v0/game/effects/readGameWorldGrantIds";

describe("effect expectations", () => {
	it("effect sources only publish global grant facts", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:grant": {
					polarity: "neutral",
					grants: [
						{
							id: "grant:test:available",
							name: "Available",
						},
					],
					name: "Availability Grant",
					sourceScope: "both",
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:test:grant",
					],
				},
			},
			startingState: {
				...baseConfig.startingState,
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

		expect([
			...readGameWorldGrantIds({
				config,
				save,
			}),
		]).toEqual([
			"grant:test:available",
		]);
	});
});
