import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readGameEffectItemCreateBlockReasons } from "~/v0/game/effects/readGameEffectItemCreateBlockReasons";

describe("readGameEffectItemCreateBlockReasons", () => {
	it("orders local item create block reasons by nearest source first", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:far-block": {
					name: "Far block",
					operations: [
						{
							kind: "item.blockCreate",
							reason: "far source blocks planks",
							target: {
								items: {
									anyOf: [
										{
											ids: [
												"item:plank",
											],
										},
									],
								},
							},
						},
					],
					radius: 3,
					scope: "local",
				},
				"effect:near-block": {
					name: "Near block",
					operations: [
						{
							kind: "item.blockCreate",
							reason: "near source blocks planks",
							target: {
								items: {
									anyOf: [
										{
											ids: [
												"item:plank",
											],
										},
									],
								},
							},
						},
					],
					radius: 3,
					scope: "local",
				},
			},
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			items: {
				...baseConfig.items,
				"item:axe": {
					...baseConfig.items["item:axe"],
					passiveEffectIds: [
						"effect:near-block",
					],
				},
				"item:rock": {
					...baseConfig.items["item:rock"],
					passiveEffectIds: [
						"effect:far-block",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:axe",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 2,
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

		expect(
			readGameEffectItemCreateBlockReasons({
				config,
				itemId: "item:plank",
				nowMs: 0,
				save,
				targetCell: {
					x: 0,
					y: 0,
				},
			}).map((reason) => reason.reason),
		).toEqual([
			"near source blocks planks",
			"far source blocks planks",
		]);
	});
});
