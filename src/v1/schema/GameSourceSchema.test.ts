import ArkiniGameConfig from "../../../game/arkini/game.json";
import LogSource from "../../../game/arkini/era-I/items/log.json";
import StoneSource from "../../../game/arkini/era-I/items/stone.json";
import TrashSource from "../../../game/arkini/era-I/items/trash.json";
import WaterSource from "../../../game/arkini/era-I/items/water.json";
import { describe, expect, it } from "vitest";

import { GameSourceSchema } from "./GameSourceSchema";

describe("GameSourceSchema", () => {
	it("parses every current Arkini authoring fragment independently", () => {
		for (const source of [
			ArkiniGameConfig,
			LogSource,
			StoneSource,
			TrashSource,
			WaterSource,
		]) {
			expect(GameSourceSchema.safeParse(source).success).toBe(true);
		}
	});
});
