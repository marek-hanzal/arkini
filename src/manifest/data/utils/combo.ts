import type { ItemMergeRule } from "../itemMergeRule";
import type { ItemId, MergeDefinitionId } from "../manifestId";

export namespace combo {
	export interface Props {
		id: MergeDefinitionId;
		withItemId: ItemId;
		resultItemId: ItemId;
		secret?: boolean;
	}
}

export const combo = (props: combo.Props): ItemMergeRule => {
	const { id, withItemId, resultItemId, secret = false } = props;

	return {
		id,
		withItemId,
		resultItemId,
		secret,
	};
};
