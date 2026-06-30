import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import type { EffectiveProducerProductLine } from "~/v0/game/effects/EffectiveProducerProductLine";
import { readRuntimeProductLineOutputViews } from "~/v0/play/game-engine-bridge/readRuntimeProductLineOutputViews";

describe("readRuntimeProductLineOutputViews", () => {
	it("lists every potential output sorted by explicit output sort", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:pollution": {
					assetId: "asset:test",
					description: "Pollution",
					maxStackSize: 99,
					name: "Pollution",
					storage: "board",
					tags: [],
					tier: 0,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const effectiveProductLine: EffectiveProducerProductLine = {
			appliedEffects: [],
			blocked: false,
			blockReasons: [],
			durationMs: 1000,
			lootPlan: {
				baseOutput: [
					{
						chance: 0.25,
						itemId: "item:pollution",
						quantity: 1,
						sort: 20,
						type: "chance",
					},
					{
						itemId: "item:twig",
						quantity: 2,
						sort: 10,
						type: "guaranteed",
					},
				],
				chanceItems: [
					{
						chance: 0.5,
						itemId: "item:plank",
					},
				],
			},
			requirements: [],
			visible: true,
		};

		expect(
			readRuntimeProductLineOutputViews({
				effectiveProductLine,
				save,
			}),
		).toMatchObject([
			{
				itemId: "item:twig",
				kind: "guaranteed",
				quantity: 2,
				sort: 10,
			},
			{
				itemId: "item:pollution",
				kind: "chance",
				probability: 0.25,
				sort: 20,
			},
			{
				itemId: "item:plank",
				kind: "chance",
				probability: 0.5,
			},
		]);
	});
});
