import type { ActivationDefinition } from "~/v0/manifest/producer";

export const activationLabel = (type: ActivationDefinition["type"]) => {
	return type === "stash" ? "Stash" : "Producer";
};
