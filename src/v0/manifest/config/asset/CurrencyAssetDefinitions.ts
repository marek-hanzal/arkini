import type { AssetDefinition } from "../../asset";
import { asset } from "../../dsl/asset";

export const CurrencyAssetDefinitions = [
	asset({
		id: "asset:item-coin",
		label: "Coin",
		fileName: "item-coin",
		sort: 101,
	}),
	asset({
		id: "asset:item-coin-pair",
		label: "Coin Pair",
		fileName: "item-coin-pair",
		sort: 102,
	}),
	asset({
		id: "asset:item-coin-stack",
		label: "Coin Stack",
		fileName: "item-coin-stack",
		sort: 103,
	}),
	asset({
		id: "asset:item-coin-chest",
		label: "Coin Chest",
		fileName: "item-coin-chest",
		sort: 104,
	}),
] satisfies AssetDefinition[];
