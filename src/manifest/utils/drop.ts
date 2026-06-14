import type { ItemId } from "../manifestId";
import type { ActivationWeightedEntry, Quantity } from "../producer";

export namespace drop {
	export interface Props {
		itemId: ItemId;
		weight: number;
		quantity?: Quantity;
	}
}

export const drop = (props: drop.Props): ActivationWeightedEntry => {
	const { itemId, weight, quantity = 1 } = props;

	return {
		itemId,
		weight,
		quantity,
	};
};
