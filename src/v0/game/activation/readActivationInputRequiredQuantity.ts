import { readActivationInputMode } from "~/v0/game/activation/readActivationInputMode";

export const readActivationInputRequiredQuantity = (input: {
	mode?: "exact" | "upTo";
	quantity: number;
}) => (readActivationInputMode(input) === "upTo" ? 1 : input.quantity);
