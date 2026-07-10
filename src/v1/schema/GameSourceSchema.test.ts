import ArkiniGameConfig from "../../../game/arkini/game.json";
import LumberjackBlueprintSource from "../../../game/arkini/era-I/blueprints/lumberjack-t1.json";
import QuarryBlueprintSource from "../../../game/arkini/era-I/blueprints/quarry-t1.json";
import SawmillBlueprintSource from "../../../game/arkini/era-I/blueprints/sawmill-t1.json";
import ShrineBlueprintSource from "../../../game/arkini/era-I/blueprints/shrine-t1.json";
import StonemasonBlueprintSource from "../../../game/arkini/era-I/blueprints/stonemason-t1.json";
import WellBlueprintSource from "../../../game/arkini/era-I/blueprints/well-t1.json";
import BioWasteSource from "../../../game/arkini/era-II/items/bio-waste.json";
import EggSource from "../../../game/arkini/era-II/items/egg.json";
import FeastPlateSource from "../../../game/arkini/era-II/items/feast-plate.json";
import GrainSource from "../../../game/arkini/era-II/items/grain.json";
import MilkSource from "../../../game/arkini/era-II/items/milk.json";
import MoraleSource from "../../../game/arkini/era-II/items/morale-t1.json";
import PigletSource from "../../../game/arkini/era-II/items/piglet.json";
import FarmersFavorSource from "../../../game/arkini/era-II/items/quest-farmers-favor.json";
import VegetablesSource from "../../../game/arkini/era-II/items/vegetables.json";
import WoolSource from "../../../game/arkini/era-II/items/wool.json";
import BeerBarrelSource from "../../../game/arkini/era-III/items/beer-barrel.json";
import BeerSource from "../../../game/arkini/era-III/items/beer.json";
import BreadSource from "../../../game/arkini/era-III/items/bread.json";
import CheeseSource from "../../../game/arkini/era-III/items/cheese.json";
import CoinSource from "../../../game/arkini/era-III/items/coin.json";
import FeastSource from "../../../game/arkini/era-III/items/feast.json";
import FlourSource from "../../../game/arkini/era-III/items/flour.json";
import GrapesSource from "../../../game/arkini/era-III/items/grapes.json";
import HopsSource from "../../../game/arkini/era-III/items/hops.json";
import MoraleT2Source from "../../../game/arkini/era-III/items/morale-t2.json";
import TavernCommissionSource from "../../../game/arkini/era-III/items/quest-tavern-commission.json";
import SausageSource from "../../../game/arkini/era-III/items/sausage.json";
import WineBarrelSource from "../../../game/arkini/era-III/items/wine-barrel.json";
import WineGlassSource from "../../../game/arkini/era-III/items/wine-glass.json";
import BasicKnowledgeSource from "../../../game/arkini/era-IV/items/basic-knowledge.json";
import BuildingPermitSource from "../../../game/arkini/era-IV/items/building-permit.json";
import PaperSource from "../../../game/arkini/era-IV/items/paper.json";
import CommonClothSource from "../../../game/arkini/era-V/items/common-cloth.json";
import CommonClothingSource from "../../../game/arkini/era-V/items/common-clothing.json";
import LeatherSource from "../../../game/arkini/era-V/items/leather.json";
import LuxuryClothSource from "../../../game/arkini/era-V/items/luxury-cloth.json";
import LuxuryClothingSource from "../../../game/arkini/era-V/items/luxury-clothing.json";
import MoraleT3Source from "../../../game/arkini/era-V/items/morale-t3.json";
import PigmentSource from "../../../game/arkini/era-V/items/pigment.json";
import RawHideSource from "../../../game/arkini/era-V/items/raw-hide.json";
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
			LumberjackBlueprintSource,
			QuarryBlueprintSource,
			SawmillBlueprintSource,
			ShrineBlueprintSource,
			StonemasonBlueprintSource,
			WellBlueprintSource,
			BioWasteSource,
			EggSource,
			FeastPlateSource,
			GrainSource,
			MilkSource,
			MoraleSource,
			PigletSource,
			FarmersFavorSource,
			VegetablesSource,
			WoolSource,
			BeerBarrelSource,
			BeerSource,
			BreadSource,
			CheeseSource,
			CoinSource,
			FeastSource,
			FlourSource,
			GrapesSource,
			HopsSource,
			MoraleT2Source,
			TavernCommissionSource,
			SausageSource,
			WineBarrelSource,
			WineGlassSource,
			BasicKnowledgeSource,
			BuildingPermitSource,
			PaperSource,
			CommonClothSource,
			CommonClothingSource,
			LeatherSource,
			LuxuryClothSource,
			LuxuryClothingSource,
			MoraleT3Source,
			PigmentSource,
			RawHideSource,
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
