import type { AssetDefinition } from "../asset";
import type { AssetId } from "../manifestId";
import { pngSrc } from "./pngSrc";

export namespace asset {
	export interface Props {
		id: AssetId;
		label: string;
		fileName: string;
		sort: number;
	}
}

export const asset = (props: asset.Props): AssetDefinition => {
	const { id, label, fileName, sort } = props;

	return {
		id,
		kind: "item",
		label,
		src: pngSrc(fileName),
		render: "plain",
		sort,
	};
};
