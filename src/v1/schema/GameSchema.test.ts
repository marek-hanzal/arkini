import ArkiniGameConfig from "../../../game/arkini/game.json";
import LogSource from "../../../game/arkini/era-I/items/log.json";
import StoneSource from "../../../game/arkini/era-I/items/stone.json";
import TreeSource from "../../../game/arkini/era-I/items/tree.json";
import TrashSource from "../../../game/arkini/era-I/items/trash.json";
import WaterSource from "../../../game/arkini/era-I/items/water.json";
import CrackedRockSource from "../../../game/arkini/era-I/items/cracked-rock.json";
import DoubleTreeSource from "../../../game/arkini/era-I/items/double-tree.json";
import MicroForestSource from "../../../game/arkini/era-I/items/micro-forest.json";
import MagnifyingGlassSource from "../../../game/arkini/era-I/items/magnifying-glass.json";
import PlankSource from "../../../game/arkini/era-I/items/plank.json";
import RockSource from "../../../game/arkini/era-I/items/rock.json";
import SeedSource from "../../../game/arkini/era-I/items/seed.json";
import StoneBlockSource from "../../../game/arkini/era-I/items/stone-block.json";
import QuestRoadRepairSource from "../../../game/arkini/era-I/items/quest-road-repair.json";
import QuestWaterCarrierSource from "../../../game/arkini/era-I/items/quest-water-carrier.json";
import AxeSource from "../../../game/arkini/era-IX/items/axe.json";
import PickaxeSource from "../../../game/arkini/era-IX/items/pickaxe.json";
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
					...CrackedRockSource.items,
					...DoubleTreeSource.items,
					...MicroForestSource.items,
					...MagnifyingGlassSource.items,
					...PlankSource.items,
					...RockSource.items,
					...SeedSource.items,
					...StoneBlockSource.items,
					...QuestRoadRepairSource.items,
					...QuestWaterCarrierSource.items,
					...AxeSource.items,
					...PickaxeSource.items,
				},
			}).success,
		).toBe(true);
	});
});
