import { describe, expect, it } from "vitest";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { readRuntimeLootDropViewsFromEffectiveProductLine } from "~/v0/play/game-engine-bridge/readRuntimeLootDropViewsFromEffectiveProductLine";

describe("readRuntimeLootDropViewsFromEffectiveProductLine", () => {
	it("shows disabled weighted entries as 0% instead of stealing enabled-entry odds", () => {
		const effectiveProductLine: EffectiveProducerProductLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [
					{
						dropEffects: [],
						enabled: true,
						entries: [
							{
								dropEffects: [],
								enabled: true,
								itemId: "item:twig",
								quantity: 1,
								visible: true,
								weight: 1,
							},
						],
						rolls: 1,
						type: "weighted",
						visible: true,
					},
				],
				chanceItems: [],
				visibleOutput: [
					{
						dropEffects: [],
						enabled: true,
						entries: [
							{
								dropEffects: [],
								enabled: true,
								itemId: "item:twig",
								quantity: 1,
								visible: true,
								weight: 1,
							},
							{
								dropEffects: [
									{
										active: false,
										display: "always",
										effectId: "product:test:output:0:entry:1:effect:0",
										effectName: "Locked Plank",
										impact: "availability",
										kind: "grant.require",
										label: "Locked Plank",
										phase: "start",
										ready: false,
										result: "disabled",
									},
								],
								enabled: false,
								itemId: "item:plank",
								quantity: 1,
								visible: true,
								weight: 1,
							},
						],
						rolls: 1,
						type: "weighted",
						visible: true,
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeLootDropViewsFromEffectiveProductLine({
				effectiveProductLine,
			}),
		).toMatchObject([
			{
				chanceLabel: "100%/roll",
				enabled: true,
				itemId: "item:twig",
			},
			{
				chanceLabel: "0%/roll",
				enabled: false,
				itemId: "item:plank",
			},
		]);
	});
});
