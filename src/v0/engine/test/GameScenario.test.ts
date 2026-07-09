import { describe, expect, it } from "vitest";
import { createGameScenario } from "~/engine/test/GameScenario";

describe("GameScenario", () => {
	it("chains setup and actions around readable board assertions", () => {
		const scenario = createGameScenario().withBoardItems([
			{
				id: "twig",
				itemId: "item:twig",
				x: 0,
				y: 0,
			},
		]);

		const moved = scenario.run({
			boardItemId: "twig",
			type: "board.item.move",
			x: 1,
			y: 0,
		});

		expect(moved.readBoardItemAt(1, 0)).toMatchObject({
			id: "twig",
			itemId: "item:twig",
		});
		expect(moved.lastResult?.events).toEqual([]);
	});

	it("keeps the previous scenario unchanged after rejected actions", () => {
		const scenario = createGameScenario().withBoardItems([
			{
				id: "twig",
				itemId: "item:twig",
				x: 0,
				y: 0,
			},
		]);

		const result = scenario.tryRun({
			boardItemId: "missing",
			type: "board.item.move",
			x: 1,
			y: 0,
		});

		expect(result.either._tag).toBe("Left");
		expect(result.scenario).toBe(scenario);
		expect(scenario.readBoardItemAt(0, 0)).toMatchObject({
			id: "twig",
		});
	});

	it("pads inventory slots from compact setup", () => {
		const scenario = createGameScenario().withInventorySlots([
			{
				itemId: "item:twig",
				quantity: 2,
			},
		]);

		expect(scenario.save.inventory.slots).toHaveLength(scenario.config.game.inventory.slots);
		expect(scenario.readInventorySlot(0)).toEqual({
			itemId: "item:twig",
			quantity: 2,
		});
	});
});
