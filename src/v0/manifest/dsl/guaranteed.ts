import type { ItemId } from "../manifestId";
import type { ActivationOutput } from "~/v0/manifest/activation/ActivationOutput";
import type { Quantity } from "~/v0/manifest/activation/Quantity";

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
