import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import { readRuntimeActivationInputAvailableQuantityFromGameSave } from "~/play/game-engine-bridge/readRuntimeActivationInputAvailableQuantityFromGameSave";

describe("readRuntimeActivationInputAvailableQuantityFromGameSave", () => {
	it("counts only consumable board input candidates plus inventory quantity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
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
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:twig",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerInputs["item-instance:2"] = {
			lineInputs: {},
		};

		expect(
			readRuntimeActivationInputAvailableQuantityFromGameSave({
				itemId: "item:twig",
				save,
				targetItemInstanceId: "item-instance:1",
			}),
		).toBe(2);
	});
});
