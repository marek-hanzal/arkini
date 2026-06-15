import type { manifestId } from "./manifestId";

export interface ItemMergeRule {
	id: manifestId.MergeDefinition;
	withItemId: manifestId.Item;
	resultItemId: manifestId.Item;
	/**
	 * Source is the dragged item. Most merges consume it, but blueprint imprint
	 * rules keep the source in place and only transform the target blueprint.
	 */
	consumeSource?: boolean;
	inputCount?: 2;
	secret?: boolean;
}
