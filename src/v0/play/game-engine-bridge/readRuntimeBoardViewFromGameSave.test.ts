import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { readRuntimeBoardViewFromGameSave } from "~/v0/play/game-engine-bridge/readRuntimeBoardViewFromGameSave";

const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

describe("readRuntimeBoardViewFromGameSave", () => {
	it("marks producer product lines blocked until stored requirements are stocked", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"producer:test": {
					...baseConfig.producers["producer:test"],
					requirements: [
						{
							capacity: 1,
							itemId: "item:axe",
							quantity: 1,
							type: "stored",
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const missingBoard = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});
		const missingLine = missingBoard.byId["item-instance:1"]?.activation?.productLines?.find(
			(line) => line.productId === "product:test",
		);

		expect(missingLine).toMatchObject({
			missingRequirementItemIds: [
				"item:axe",
			],
			requirementsReady: false,
		});

		save.storedRequirements["item-instance:1"] = {
			items: {
				"item:axe": 1,
			},
		};
		const stockedBoard = readRuntimeBoardViewFromGameSave({
			config,
			nowMs: 0,
			save,
		});
		const stockedLine = stockedBoard.byId["item-instance:1"]?.activation?.productLines?.find(
			(line) => line.productId === "product:test",
		);

		expect(stockedLine).toMatchObject({
			missingRequirementItemIds: [],
			requirementsReady: true,
		});
	});
});
