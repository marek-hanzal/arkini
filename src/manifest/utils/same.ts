import type { ItemMergeRule } from "../itemMergeRule";
import type { ItemId, MergeDefinitionId } from "../manifestId";

export namespace same {
	export interface Props {
		id: MergeDefinitionId;
		selfItemId: ItemId;
		resultItemId: ItemId;
	}
}

export const same = (props: same.Props): ItemMergeRule => {
	const { id, selfItemId, resultItemId } = props;

	return {
		id,
		withItemId: selfItemId,
		resultItemId,
	};
};
