import type { CraftRecipeInput, ItemCraftRecipe } from "../craft";
import type { CraftRecipeId, ItemId } from "../manifestId";

export namespace craft {
	export interface Props {
		id: CraftRecipeId;
		resultItemId: ItemId;
		inputs: readonly CraftRecipeInput[];
		durationMs?: number;
	}
}

export const craft = (props: craft.Props): ItemCraftRecipe => {
	const { id, resultItemId, inputs, durationMs = 0 } = props;

	return {
		id,
		resultItemId,
		inputs,
		durationMs,
	};
};
