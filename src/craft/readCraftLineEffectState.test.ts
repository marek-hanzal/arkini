import { describe, expect, it } from "vitest";
import { readCraftLineEffectState } from "~/craft/readCraftLineEffectState";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";

describe("readCraftLineEffectState", () => {
	it("expands missing owned grant requirements into concrete item blockers", () => {
		const config = createEngineTestConfig({
			craftOverrides: {
				"item:craft-table": {
					durationMs: 1000,
					effects: [
						{
							display: "always",
							kind: "grant.require",
							phase: "start",
							selector: {
								allOf: [
									{
										ids: [
											"grant:owned:item:key",
										],
									},
								],
							},
						},
					],
					inputs: [
						{
							consume: true,
							itemId: "item:twig",
							quantity: 2,
						},
					],
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
			itemEffects: {
				"item:key": [
					{
						grants: [
							{
								id: "grant:owned:item:key",
								name: "Owns Key",
							},
						],
						id: "effect:grant-owned:item-key",
						name: "Owned Key grant",
						polarity: "neutral",
						sourceScope: "both",
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const recipe = config.items["item:craft-table"]?.craft;
		if (!recipe) throw new Error("Missing test craft recipe.");

		expect(
			readCraftLineEffectState({
				config,
				recipe,
				save,
			}).requirements,
		).toEqual([
			{
				display: "always",
				itemId: "item:key",
				kind: "grant.require",
				label: "Key",
				ready: false,
			},
		]);
	});
});
