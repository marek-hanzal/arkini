import type { LootTableId } from "../manifestId";
import type { ProducerDefinition } from "~/v0/manifest/activation/ProducerDefinition";

export namespace clickProducer {
	export interface Props {
		cooldownMs: number;
		outputTableId: LootTableId;
		inputs?: readonly NonNullable<ProducerDefinition["inputs"]>[number][];
		requirements?: readonly NonNullable<ProducerDefinition["requirements"]>[number][];
	}
}

export const clickProducer = (props: clickProducer.Props): ProducerDefinition => {
	const { cooldownMs, outputTableId, inputs = [], requirements = [] } = props;

	return {
		type: "producer",
		trigger: "click",
		placement: "board_then_inventory",
		outputTableId,
		cooldownMs,
		inputs,
		requirements,
	};
};
