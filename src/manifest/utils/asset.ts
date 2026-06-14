import type { AssetDefinition } from "../asset";
import type { AssetId } from "../manifestId";

const png = (name: string) => new URL(`../../assets/${name}.png`, import.meta.url).href;

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
		src: png(fileName),
		render: "plain",
		sort,
	};
};
