import { readActivationInputMode } from "~/activation/readActivationInputMode";

export const readActivationInputSelectedQuantityAccepted = ({
	input,
	selectedQuantity,
}: {
	input: {
		mode?: "exact" | "upTo";
		quantity: number;
	};
	selectedQuantity: number;
}) =>
	readActivationInputMode(input) === "upTo"
		? selectedQuantity >= 1 && selectedQuantity <= input.quantity
		: selectedQuantity === input.quantity;
