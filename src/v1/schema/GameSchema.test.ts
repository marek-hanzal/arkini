import ArkiniGameConfig from "../../../game/arkini/game.json";
import LogSource from "../../../game/arkini/era-I/items/log.json";
import StoneSource from "../../../game/arkini/era-I/items/stone.json";
import TreeSource from "../../../game/arkini/era-I/items/tree.json";
import TrashSource from "../../../game/arkini/era-I/items/trash.json";
import WaterSource from "../../../game/arkini/era-I/items/water.json";
import DoubleTreeSource from "../../../game/arkini/era-I/items/double-tree.json";
import MicroForestSource from "../../../game/arkini/era-I/items/micro-forest.json";
import SeedSource from "../../../game/arkini/era-I/items/seed.json";
import AxeSource from "../../../game/arkini/era-IX/items/axe.json";
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
					...TreeSource.items,
					...TrashSource.items,
					...WaterSource.items,
					...DoubleTreeSource.items,
					...MicroForestSource.items,
					...SeedSource.items,
					...AxeSource.items,
				},
			}).success,
		).toBe(true);
	});
});
