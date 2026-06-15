import type { LootTableId } from "./manifestId";
import type { ActivationOutput } from "./producer";

export interface LootTableDefinition {
	id: LootTableId;
	name: string;
	output: readonly ActivationOutput[];
}
