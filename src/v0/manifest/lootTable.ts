import type { LootTableId } from "./manifestId";
import type { ActivationOutput } from "~/v0/manifest/activation/ActivationOutput";

export interface LootTableDefinition {
	id: LootTableId;
	name: string;
	output: readonly ActivationOutput[];
}
