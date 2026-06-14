import { runEffect } from "~/play/logic/runEffect";
import { produceFx } from "~/producer/fx/produceFx";
import { withdrawInputFx } from "~/producer/fx/withdrawInputFx";

export namespace activateProducer {
	export interface Props {
		boardItemId: string;
		activation?: "single" | "exhaust";
	}
}

export const activateProducer = ({ boardItemId, activation = "single" }: activateProducer.Props) =>
	runEffect(
		produceFx({
			boardItemId,
			activation,
		}),
	);

export namespace withdrawProducerInput {
	export interface Props {
		boardItemId: string;
		itemId: string;
	}
}

export const withdrawProducerInput = ({ boardItemId, itemId }: withdrawProducerInput.Props) =>
	runEffect(
		withdrawInputFx({
			boardItemId,
			itemId,
		}),
	);
