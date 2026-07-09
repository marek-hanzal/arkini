import { readActivationInputMode } from "~/activation/readActivationInputMode";

export const readActivationInputRequiredQuantity = (input: {
	mode?: "exact" | "upTo";
	quantity: number;
}) => (readActivationInputMode(input) === "upTo" ? 1 : input.quantity);
