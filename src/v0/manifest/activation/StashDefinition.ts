import type { ItemId } from "~/v0/manifest/manifestId";
import type { ActivationSharedDefinition } from "~/v0/manifest/activation/ActivationSharedDefinition";

export interface StashDefinition extends ActivationSharedDefinition {
	type: "stash";
	charges: number;
	onDepleted:
		| "remove"
		| {
				replaceWithItemId: ItemId;
		  };
}
