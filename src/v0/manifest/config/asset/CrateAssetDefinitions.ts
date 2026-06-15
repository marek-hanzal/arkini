import type { AssetDefinition } from "../../asset";
import { asset } from "../../dsl/asset";

export const CrateAssetDefinitions = [
	asset({
		id: "asset:item-crate",
		label: "Common Crate",
		fileName: "item-crate",
		sort: 150,
	}),
	asset({
		id: "asset:item-crate-sturdy",
		label: "Sturdy Crate",
		fileName: "item-crate-sturdy",
		sort: 160,
	}),
	asset({
		id: "asset:item-crate-rare",
		label: "Rare Crate",
		fileName: "item-crate-rare",
		sort: 170,
	}),
	asset({
		id: "asset:item-crate-epic",
		label: "Epic Crate",
		fileName: "item-crate-epic",
		sort: 180,
	}),
	asset({
		id: "asset:item-epic-key",
		label: "Epic Key",
		fileName: "item-epic-key",
		sort: 182,
	}),
] satisfies AssetDefinition[];
