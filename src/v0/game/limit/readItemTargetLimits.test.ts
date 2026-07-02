import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readItemTargetLimits } from "~/v0/game/limit/readItemTargetLimits";
import { createInitialGameSaveFx } from "~/v0/game/save/createInitialGameSaveFx";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

const cloneSave = (save: GameSave): GameSave => structuredClone(save);

describe("readItemTargetLimits", () => {
	it("counts pending producer jobs from their currently effective enabled output", () => {
		const baseConfig = createEngineTestConfig();
		const grantId = "grant:test:disable-output";
		const effectId = "effect:test:disable-output";
		const config = createEngineTestConfig({
			effects: {
				...baseConfig.effects,
				[effectId]: {
					grants: [
						{
							id: grantId,
							name: "Disable output",
						},
					],
					name: "Disable output",
					polarity: "debuff",
				},
			},
			items: {
				...baseConfig.items,
				"item:key": {
					...baseConfig.items["item:key"],
					passiveEffectIds: [
						effectId,
					],
				},
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
			producerItemInstanceId: "item-instance:1",
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
