import type { AssetId } from "./manifestId";

export interface AssetDefinition {
	id: AssetId;
	kind: "item" | "ui";
	label: string;
	src: string;
	overlayAssetId?: AssetId;
	render?: "plain" | "blueprint";
	sort: number;
}
