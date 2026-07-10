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

import { GameSourceSchema } from "./GameSourceSchema";

describe("GameSourceSchema", () => {
	it("parses every current Arkini authoring fragment independently", () => {
		for (const source of [
			ArkiniGameConfig,
			LogSource,
			StoneSource,
			TreeSource,
			TrashSource,
			WaterSource,
			CrackedRockSource,
			DoubleTreeSource,
			MicroForestSource,
			MagnifyingGlassSource,
			PlankSource,
			RockSource,
			SeedSource,
			StoneBlockSource,
			QuestRoadRepairSource,
			QuestWaterCarrierSource,
			AxeSource,
			PickaxeSource,
		]) {
			expect(GameSourceSchema.safeParse(source).success).toBe(true);
		}
	});
});
