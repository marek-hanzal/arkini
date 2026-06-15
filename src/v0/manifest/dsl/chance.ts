import type { ItemId } from "../manifestId";
import type { ActivationOutput, Quantity } from "../producer";

export namespace chance {
	export interface Props {
		itemId: ItemId;
		probability: number;
		quantity?: Quantity;
	}
}

export const chance = (props: chance.Props): ActivationOutput => {
	const { itemId, probability, quantity = 1 } = props;

	return {
		type: "chance",
		itemId,
		probability,
		quantity,
	};
};
