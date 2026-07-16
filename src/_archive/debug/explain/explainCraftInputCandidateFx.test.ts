import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { explainCraftInputCandidateFx } from "~/debug/explain/explainCraftInputCandidateFx";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { createGameScenario } from "~/engine/test/GameScenario";

const runExplain = (props: Parameters<typeof explainCraftInputCandidateFx>[0]) =>
	Effect.runSync(explainCraftInputCandidateFx(props));

describe("explainCraftInputCandidateFx", () => {
	it("explains accepted craft input candidates", () => {
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				title: "Test",
				board: {
					height: 1,
					width: 2,
				},
				inventory: {
					slots: 2,
				},
			},
		});
		const scenario = createGameScenario({
			config,
		})
			.withBoardItems([
				{
					id: "craft",
					itemId: "item:craft-table",
					x: 0,
					y: 0,
				},
			])
			.withInventorySlots([
				{
					itemId: "item:twig",
					quantity: 2,
				},
			]);

		expect(
			runExplain({
				action: {
					inputRef: {
						kind: "inventory",
						quantity: 2,
						slotIndex: 0,
					},
					targetItemInstanceId: "craft",
					type: "craft.input.store",
				},
				config,
				save: scenario.save,
			}),
		).toMatchObject({
			outcome: "accepted",
			steps: expect.arrayContaining([
				expect.objectContaining({
					code: "accepted_craft_input_candidate",
					details: expect.objectContaining({
						acceptedQuantity: 2,
						inputItemId: "item:twig",
					}),
				}),
			]),
		});
	});

	it("explains rejected craft input candidates", () => {
		const config = createEngineTestConfig();
		const scenario = createGameScenario({
			config,
		}).withBoardItems([
			{
				id: "craft",
				itemId: "item:craft-table",
				x: 0,
				y: 0,
			},
		]);

		expect(
			runExplain({
				action: {
					inputRef: {
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
					targetItemInstanceId: "craft",
					type: "craft.input.store",
				},
				config,
				save: scenario.save,
			}),
		).toMatchObject({
			outcome: "blocked",
			steps: expect.arrayContaining([
				expect.objectContaining({
					code: "blocked_GameActionRejected",
					details: expect.objectContaining({
						reason: "input_unavailable",
					}),
				}),
			]),
		});
	});
});
