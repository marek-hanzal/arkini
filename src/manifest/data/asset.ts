import type { AssetId } from "./manifestId";

export interface AssetDefinition {
	id: AssetId;
	kind: "item" | "ui";
	label: string;
	src: string;
	sort: number;
}
