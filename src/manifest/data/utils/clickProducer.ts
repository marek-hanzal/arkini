import type { LootTableId } from "../manifestId";
import type { ProducerDefinition } from "../producer";

export namespace clickProducer {
	export interface Props {
		cooldownMs: number;
		outputTableId: LootTableId;
		inputs?: readonly NonNullable<ProducerDefinition["inputs"]>[number][];
	}
}

export const clickProducer = (props: clickProducer.Props): ProducerDefinition => {
	const { cooldownMs, outputTableId, inputs = [] } = props;

	return {
		type: "producer",
		trigger: "click",
		placement: "board_then_inventory",
		outputTableId,
		cooldownMs,
		inputs,
	};
};
