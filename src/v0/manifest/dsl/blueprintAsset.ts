import type { AssetDefinition } from "../asset";
import type { AssetId } from "../manifestId";
import { pngSrc } from "./pngSrc";

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
		src: pngSrc("item-blueprint"),
		overlayAssetId,
		render: "blueprint",
		sort,
	};
};
