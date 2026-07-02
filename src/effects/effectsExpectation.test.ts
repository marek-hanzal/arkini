import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import { readGameWorldGrantIds } from "~/effects/readGameWorldGrantIds";

describe("effect expectations", () => {
	it("effect sources only publish global grant facts", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: "effect:test:grant",
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
				],
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
