import type { ItemId } from "../manifestId";
import type { ActivationOutput, Quantity } from "../producer";

export namespace guaranteed {
	export interface Props {
		itemId: ItemId;
		quantity?: Quantity;
	}
}

export const guaranteed = (props: guaranteed.Props): ActivationOutput => {
	const { itemId, quantity = 1 } = props;

	return {
		type: "guaranteed",
		itemId,
		quantity,
	};
};
