import type { CraftRecipeInput } from "../craft";
import type { ItemId } from "../manifestId";

export namespace input {
	export interface Props {
		itemId: ItemId;
		quantity: number;
	}
}

export const input = (props: input.Props): CraftRecipeInput => {
	const { itemId, quantity } = props;

	return {
		itemId,
		quantity,
	};
};
