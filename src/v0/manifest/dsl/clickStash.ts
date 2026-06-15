import type { LootTableId } from "../manifestId";
import type { StashDefinition } from "~/v0/manifest/activation/StashDefinition";

export namespace clickStash {
	export interface Props {
		charges: number;
		outputTableId: LootTableId;
		onDepleted?: StashDefinition["onDepleted"];
		inputs?: readonly NonNullable<StashDefinition["inputs"]>[number][];
		requirements?: readonly NonNullable<StashDefinition["requirements"]>[number][];
	}
}

export const clickStash = (props: clickStash.Props): StashDefinition => {
	const { charges, outputTableId, onDepleted = "remove", inputs = [], requirements = [] } = props;

	return {
		type: "stash",
		trigger: "click",
		placement: "board_then_inventory",
		charges,
		onDepleted,
		outputTableId,
		inputs,
		requirements,
	};
};
