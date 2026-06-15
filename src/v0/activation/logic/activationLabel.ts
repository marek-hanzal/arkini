import type { ActivationDefinition } from "~/v0/manifest/activation/ActivationDefinition";

export const activationLabel = (type: ActivationDefinition["type"]) => {
	return type === "stash" ? "Stash" : "Producer";
};
