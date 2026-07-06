export namespace readAcceptedTransferQuantity {
	export interface Props {
		availableQuantity: number;
		remainingCapacity: number;
	}
}

export const readAcceptedTransferQuantity = ({
	availableQuantity,
	remainingCapacity,
}: readAcceptedTransferQuantity.Props) =>
	Math.max(0, Math.min(availableQuantity, remainingCapacity));
