import type { manifestId } from "./manifestId";

export interface ItemMergeRule {
	id: manifestId.MergeDefinition;
	withItemId: manifestId.Item;
	resultItemId: manifestId.Item;
	inputCount?: 2;
	secret?: boolean;
}
