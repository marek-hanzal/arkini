import type { LootTableId } from "./manifestId";
import type { ProducerOutput } from "./producer";

export interface LootTableDefinition {
	id: LootTableId;
	name: string;
	output: readonly ProducerOutput[];
}
