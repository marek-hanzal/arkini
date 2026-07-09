import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readItemTargetLimits } from "~/limit/readItemTargetLimits";
import { createInitialGameSaveFx } from "~/save/createInitialGameSaveFx";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

const cloneSave = (save: GameSave): GameSave => structuredClone(save);

describe("readItemTargetLimits", () => {
	it("counts pending producer jobs from their currently effective enabled output", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:disable-output";
		const effectId = "effect:test:disable-output";
		const config = createEngineTestConfig({
			itemEffects: {
				"item:key": [
					{
						id: effectId,
						grants: [
							{
								id: grantId,
								name: "Disable output",
							},
						],
						name: "Disable output",
						polarity: "debuff",
					},
				],
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					maxCount: 2,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							entries: [
								{
									effects: [
										{
											display: "always" as const,
											kind: "grant.drop.disable" as const,
											selector: {
												allOf: [
													{
														ids: [
															grantId,
														],
													},
												],
											},
										},
									],
									itemId: "item:twig",
									quantity: 2,
									type: "guaranteed" as const,
								},
							],
						},
					],
				},
			},
		});
		const save = cloneSave(
			runInitialSave({
				config,
				nowMs: 0,
			}),
		);
		save.producerJobs["job:pending"] = {
			id: "job:pending",
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			readyAtMs: 1000,
			startAtMs: 0,
		};
		save.board.items["item-instance:key"] = {
			createdAtMs: 0,
			id: "item-instance:key",
			itemId: "item:key",
			x: 1,
			y: 0,
		};

		expect(
			readItemTargetLimits({
				config,
				includePendingProducerJobs: true,
				itemId: "item:twig",
				nowMs: 250,
				save,
			}),
		).toMatchObject([
			{
				itemId: "item:twig",
				maxCount: 2,
				ownedQuantity: 0,
				remainingQuantity: 2,
			},
		]);
	});
});
