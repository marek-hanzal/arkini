import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace readOrCreateProducerLineInputStateFx {
	export interface Props {
		itemInstanceId: string;
		lineId: string;
		save: GameSave;
	}
}

export const readOrCreateProducerLineInputStateFx = Effect.fn(
	"readOrCreateProducerLineInputStateFx",
)(function* ({ itemInstanceId, lineId, save }: readOrCreateProducerLineInputStateFx.Props) {
	const producerInputState = (save.producerInputs[itemInstanceId] ??= {
		lineInputs: {},
	});

	return (producerInputState.lineInputs[lineId] ??= {
		items: {},
	});
});
