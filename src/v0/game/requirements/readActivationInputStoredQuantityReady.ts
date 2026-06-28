import { readActivationInputRequiredQuantity } from "~/v0/game/requirements/readActivationInputRequiredQuantity";

export const readActivationInputStoredQuantityReady = ({
	input,
	storedQuantity,
}: {
	input: {
		mode?: "exact" | "upTo";
		quantity: number;
	};
	storedQuantity: number;
}) => storedQuantity >= readActivationInputRequiredQuantity(input);
