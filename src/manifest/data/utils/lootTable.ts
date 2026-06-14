import type { LootTableDefinition } from "../lootTable";
import type { LootTableId } from "../manifestId";
import type { ActivationOutput } from "../producer";

export namespace lootTable {
	export interface Props {
		id: LootTableId;
		name: string;
		output: readonly ActivationOutput[];
	}
}

export const lootTable = (props: lootTable.Props): LootTableDefinition => {
	const { id, name, output } = props;

	return {
		id,
		name,
		output,
	};
};
