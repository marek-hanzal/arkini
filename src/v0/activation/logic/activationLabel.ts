import type { ActivationDefinition } from "~/manifest/producer";

export const activationLabel = (type: ActivationDefinition["type"]) => {
	return type === "stash" ? "Stash" : "Producer";
};
