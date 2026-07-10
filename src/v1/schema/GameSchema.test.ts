import ArkiniGameConfig from "../../../game/arkini/game.json";
import LogSource from "../../../game/arkini/era-I/items/log.json";
import StoneSource from "../../../game/arkini/era-I/items/stone.json";
import TrashSource from "../../../game/arkini/era-I/items/trash.json";
import WaterSource from "../../../game/arkini/era-I/items/water.json";
import { describe, expect, it } from "vitest";

import { GameSchema } from "./GameSchema";

describe("GameSchema", () => {
	it("parses the current Arkini game configuration after source fragments are merged", () => {
		expect(
			GameSchema.safeParse({
				...ArkiniGameConfig,
				items: {
					...LogSource.items,
					...StoneSource.items,
					...TrashSource.items,
					...WaterSource.items,
				},
			}).success,
		).toBe(true);
	});
});
