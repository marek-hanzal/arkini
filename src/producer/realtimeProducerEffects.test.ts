import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import { readEffectiveLine } from "~/effects/readEffectiveLine";

describe("realtime line effects", () => {
	it("computes duration from current nearby board state through output-owned rules", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed",
									effects: [
										{
											bands: [
												{
													distance: "neighbour",
													multiplier: 0.5,
												},
												],
											display: "whenActive",
											items: {
												anyOf: [
													{
														ids: [
															"item:axe",
														],
													},
												],
											},
											kind: "nearby.duration.multiply",
											label: "Nearby Axe Haste",
										},
									],
								},
							],
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:axe",
						x: 1,
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
		const line = config.lineCatalog["line:test"];

		expect(
			readEffectiveLine({
				baseDurationMs: line.durationMs,
				config,
				itemInstanceId: "item-instance:1",
				line,
				lineId: "line:test",
				save,
			}).durationMs,
		).toBe(500);
	});
});
