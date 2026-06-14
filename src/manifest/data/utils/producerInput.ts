import type { ItemId } from "../manifestId";
import type { ProducerDefinition } from "../producer";

export namespace producerInput {
	export interface Props {
		itemId: ItemId;
		quantity: number;
		capacity?: number;
	}
}

export const producerInput = (
	props: producerInput.Props,
): NonNullable<ProducerDefinition["inputs"]>[number] => {
	const { itemId, quantity, capacity = Math.max(quantity * 3, quantity) } = props;

	return {
		itemId,
		quantity,
		capacity,
	};
};
