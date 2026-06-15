import type { ItemId } from "../manifestId";
import type { ActivationOutput } from "~/v0/manifest/activation/ActivationOutput";
import type { Quantity } from "~/v0/manifest/activation/Quantity";

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
