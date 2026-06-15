import type { ActivationSharedDefinition } from "~/v0/manifest/activation/ActivationSharedDefinition";

export interface ProducerDefinition extends ActivationSharedDefinition {
	type: "producer";
	cooldownMs: number;
}
