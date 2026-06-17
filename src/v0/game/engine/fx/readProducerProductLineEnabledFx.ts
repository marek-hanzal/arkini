import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readProducerProductLineEnabledFx {
	export interface Props {
		save: GameSave;
		producerItemInstanceId: string;
		productId: string;
	}
}

export const readProducerProductLineEnabledFx = Effect.fn(
	"readProducerProductLineEnabledFx",
)(function* ({ save, producerItemInstanceId, productId }: readProducerProductLineEnabledFx.Props) {
	return !(save.producerLines[producerItemInstanceId]?.disabledProductIds ?? []).includes(
		productId,
	);
});
