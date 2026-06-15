import type { AssetDefinition } from "../../asset";
import { asset } from "../../dsl/asset";

export const BuildingAssetDefinitions = [
	asset({
		id: "asset:item-townhall",
		label: "Town Hall",
		fileName: "item-townhall",
		sort: 125,
	}),
	asset({
		id: "asset:item-lumber-camp",
		label: "Lumber Camp",
		fileName: "item-lumber-camp",
		sort: 130,
	}),
	asset({
		id: "asset:item-coal-mine",
		label: "Coal Mine",
		fileName: "item-coal-mine",
		sort: 138,
	}),
	asset({
		id: "asset:item-quarry",
		label: "Quarry",
		fileName: "item-quarry",
		sort: 140,
	}),
] satisfies AssetDefinition[];
