import type { ItemDefinition } from "../item";
import type { AssetId, ItemId } from "../manifestId";

export namespace item {
	export interface Props {
		id: ItemId;
		assetId: AssetId;
		code: string;
		name: string;
		tier: number;
		maxStackSize: number;
		description: string;
		tags: readonly string[];
		sort: number;
		behavior?: Pick<ItemDefinition, "label" | "merge" | "producer" | "stash" | "craft">;
	}
}

export const item = (props: item.Props): ItemDefinition => {
	const {
		id,
		assetId,
		code,
		name,
		tier,
		maxStackSize,
		description,
		tags,
		sort,
		behavior = {},
	} = props;

	return {
		id,
		assetId,
		code,
		name,
		tier,
		maxStackSize,
		description,
		tags,
		sort,
		...behavior,
	};
};
