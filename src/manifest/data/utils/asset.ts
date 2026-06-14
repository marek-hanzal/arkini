import type { AssetDefinition } from "../asset";
import type { AssetId } from "../manifestId";

const svg = (name: string) => new URL(`../svg/${name}.svg`, import.meta.url).href;
const png = (name: string) => new URL(`../png/${name}.png`, import.meta.url).href;

export namespace asset {
	export interface Props {
		id: AssetId;
		label: string;
		fileName: string;
		sort: number;
		format?: "svg" | "png";
	}
}

export const asset = (props: asset.Props): AssetDefinition => {
	const { id, label, fileName, sort, format = "svg" } = props;

	return {
		id,
		kind: "item",
		label,
		src: format === "png" ? png(fileName) : svg(fileName),
		render: "plain",
		sort,
	};
};
