import type { AssetDefinition } from "../../asset";
import { asset } from "../../dsl/asset";
import { blueprintAsset } from "../../dsl/blueprintAsset";

export const BlueprintAssetDefinitions = [
	asset({
		id: "asset:item-blueprint-scrap",
		label: "Blueprint Scrap",
		fileName: "item-blueprint-scrap",
		sort: 106,
	}),
	asset({
		id: "asset:item-blueprint-fragment",
		label: "Blueprint Fragment",
		fileName: "item-blueprint-fragment",
		sort: 108,
	}),
	asset({
		id: "asset:item-blueprint-draft",
		label: "Blueprint Draft",
		fileName: "item-blueprint-draft",
		sort: 110,
	}),
	asset({
		id: "asset:item-blueprint",
		label: "Finished Blueprint",
		fileName: "item-blueprint",
		sort: 112,
	}),
	blueprintAsset({
		id: "asset:item-blueprint-lumber-camp",
		label: "Lumber Camp Blueprint",
		overlayAssetId: "asset:item-lumber-camp",
		sort: 116,
	}),
	blueprintAsset({
		id: "asset:item-blueprint-quarry",
		label: "Quarry Blueprint",
		overlayAssetId: "asset:item-quarry",
		sort: 120,
	}),
	blueprintAsset({
		id: "asset:item-blueprint-townhall",
		label: "Town Hall Blueprint",
		overlayAssetId: "asset:item-townhall",
		sort: 124,
	}),
] satisfies AssetDefinition[];
