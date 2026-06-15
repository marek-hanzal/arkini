import type { ItemMergeRule } from "../itemMergeRule";
import type { ItemId, MergeDefinitionId } from "../manifestId";

export namespace imprint {
	export interface Props {
		id: MergeDefinitionId;
		withItemId: ItemId;
		resultItemId: ItemId;
	}
}

export const imprint = (props: imprint.Props): ItemMergeRule => {
	const { id, withItemId, resultItemId } = props;

	return {
		id,
		withItemId,
		resultItemId,
		consumeSource: false,
		secret: true,
	};
};
