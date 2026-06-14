import type { AssetDefinition } from "../asset";
import type { AssetId } from "../manifestId";

const png = (name: string) => new URL(`../png/${name}.png`, import.meta.url).href;

export namespace blueprintAsset {
	export interface Props {
		id: AssetId;
		label: string;
		overlayAssetId: AssetId;
		sort: number;
	}
}

export const blueprintAsset = (props: blueprintAsset.Props): AssetDefinition => {
	const { id, label, overlayAssetId, sort } = props;

	return {
		id,
		kind: "item",
		label,
		src: png("item-blueprint"),
		overlayAssetId,
		render: "blueprint",
		sort,
	};
};
