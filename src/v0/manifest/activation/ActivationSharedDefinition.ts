import type { LootTableId } from "~/v0/manifest/manifestId";
import type { ActivationInputDefinition } from "~/v0/manifest/activation/ActivationInputDefinition";
import type { ActivationPlacement } from "~/v0/manifest/activation/ActivationPlacement";
import type { ActivationRequirementDefinition } from "~/v0/manifest/activation/ActivationRequirementDefinition";
import type { ActivationTrigger } from "~/v0/manifest/activation/ActivationTrigger";

export interface ActivationSharedDefinition {
	trigger: ActivationTrigger;
	placement: ActivationPlacement;
	outputTableId: LootTableId;
	inputs?: readonly ActivationInputDefinition[];
	requirements?: readonly ActivationRequirementDefinition[];
}
